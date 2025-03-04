import React, {
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import { ThemeContext } from 'styled-components';
import { defaultProps } from '../../default-props';
import { AnnounceContext } from '../../contexts/AnnounceContext';
import { MessageContext } from '../../contexts/MessageContext';

import { Box } from '../Box';
import { Button } from '../Button';
import { Heading } from '../Heading';
import { Keyboard } from '../Keyboard';

import {
  StyledCalendar,
  StyledDay,
  StyledDayContainer,
  StyledWeek,
  StyledWeeks,
  StyledWeeksContainer,
} from './StyledCalendar';
import {
  addDays,
  addMonths,
  betweenDates,
  daysApart,
  endOfMonth,
  formatToLocalYYYYMMDD,
  localTimezoneToUTC,
  startOfMonth,
  subtractDays,
  subtractMonths,
  withinDates,
} from './utils';

const headingPadMap = {
  small: 'xsmall',
  medium: 'small',
  large: 'medium',
};

const activeDates = {
  start: 'start',
  end: 'end',
};

const timeStamp = new RegExp(/T.*/);

const normalizeForTimezone = (date, refDate) => {
  if (!date) return undefined;
  return (
    !timeStamp.test(refDate || date)
      ? localTimezoneToUTC(new Date(date))
      : new Date(date)
  ).toISOString();
};

const normalizeReference = (reference, date, dates) => {
  let normalizedReference;
  if (reference) {
    normalizedReference = new Date(reference);
  } else if (date) {
    if (typeof date === 'string') {
      normalizedReference = new Date(date);
    } else if (Array.isArray(date)) {
      if (typeof date[0] === 'string') {
        normalizedReference = new Date(date[0]);
      } else if (Array.isArray(date[0])) {
        normalizedReference = new Date(date[0][0] ? date[0][0] : date[0][1]);
      } else {
        normalizedReference = new Date();
        normalizedReference.setHours(0, 0, 0, 0);
      }
    }
  } else if (dates && dates.length > 0) {
    if (typeof dates[0] === 'string') {
      normalizedReference = new Date(dates[0]);
    } else if (Array.isArray(dates[0])) {
      normalizedReference = new Date(dates[0][0] ? dates[0][0] : dates[0][1]);
    } else {
      normalizedReference = new Date();
      normalizedReference.setHours(0, 0, 0, 0);
    }
  } else {
    normalizedReference = new Date();
    normalizedReference.setHours(0, 0, 0, 0);
  }
  return normalizedReference;
};

const buildDisplayBounds = (reference, firstDayOfWeek) => {
  let start = new Date(reference);
  start.setDate(1); // first of month

  // In case Sunday is the first day of the month, and the user asked for Monday
  // to be the first day of the week, then we need to include Sunday and six
  // days prior.
  start =
    start.getDay() === 0 && firstDayOfWeek === 1
      ? (start = subtractDays(start, 6))
      : // beginning of week
        (start = subtractDays(start, start.getDay() - firstDayOfWeek));

  const end = addDays(start, 7 * 5 + 7); // 5 weeks to end of week
  return [start, end];
};

const millisecondsPerYear = 31557600000;

const CalendarDayButton = (props) => <Button tabIndex={-1} plain {...props} />;

const CalendarDay = ({
  children,
  fill,
  size,
  isInRange,
  isSelected,
  otherMonth,
  buttonProps = {},
}) => (
  <StyledDayContainer role="gridcell" sizeProp={size} fillContainer={fill}>
    <CalendarDayButton fill={fill} {...buttonProps}>
      <StyledDay
        disabledProp={buttonProps.disabled}
        inRange={isInRange}
        otherMonth={otherMonth}
        isSelected={isSelected}
        sizeProp={size}
        fillContainer={fill}
      >
        {children}
      </StyledDay>
    </CalendarDayButton>
  </StyledDayContainer>
);

const CalendarCustomDay = ({ children, fill, size, buttonProps }) => {
  if (!buttonProps) {
    return (
      <StyledDayContainer role="gridcell" sizeProp={size} fillContainer={fill}>
        {children}
      </StyledDayContainer>
    );
  }

  return (
    <StyledDayContainer role="gridcell" sizeProp={size} fillContainer={fill}>
      <CalendarDayButton fill={fill} {...buttonProps}>
        {children}
      </CalendarDayButton>
    </StyledDayContainer>
  );
};

const Calendar = forwardRef(
  (
    {
      activeDate: activeDateProp,
      animate = true,
      bounds: boundsProp,
      children,
      date: dateProp,
      dates: datesProp,
      daysOfWeek,
      disabled,
      fill,
      firstDayOfWeek = 0,
      header,
      locale = 'en-US',
      messages,
      onReference,
      onSelect,
      range,
      reference: referenceProp,
      showAdjacentDays = true,
      size = 'medium',
      ...rest
    },
    ref,
  ) => {
    const theme = useContext(ThemeContext) || defaultProps.theme;
    const announce = useContext(AnnounceContext);
    const { format } = useContext(MessageContext);

    // set activeDate when caller changes it, allows us to change
    // it internally too
    const [activeDate, setActiveDate] = useState(
      dateProp && typeof dateProp === 'string' && range
        ? activeDates.end
        : activeDates.start,
    );
    useEffect(() => {
      if (activeDateProp) setActiveDate(activeDateProp);
    }, [activeDateProp]);

    // function that runs inside the useEffect for date and dates
    const normalizeDate = (dateValue) => {
      // convert values to UTC based on if date is string or array
      if (typeof dateValue === 'string') {
        return normalizeForTimezone(dateValue);
      }
      if (Array.isArray(dateValue)) {
        if (Array.isArray(dateValue[0])) {
          let from;
          let to;
          [from, to] = dateValue[0].map((day) =>
            day ? new Date(day) : undefined,
          );
          if (from) from = normalizeForTimezone(from, dateValue[0][0]);
          if (to) to = normalizeForTimezone(to, dateValue[0][0]);

          return [[from, to]];
        }
        const dateArray = [];
        dateValue.forEach((d) => {
          if (Array.isArray(d)) {
            let from;
            let to;
            [from, to] = d.map((day) => new Date(day));
            from = normalizeForTimezone(from, d[0]);
            to = normalizeForTimezone(to, d[0]);
            dateArray.push([from, to]);
          } else {
            dateArray.push(normalizeForTimezone(d));
          }
        });
        return dateArray;
      }
      return undefined;
    };

    // set date when caller changes it, allows us to change it internally too
    const [date, setDate] = useState(dateProp);
    useEffect(() => {
      setDate(normalizeDate(dateProp));
    }, [dateProp]);

    // set dates when caller changes it, allows us to change it internally too
    const [dates, setDates] = useState(datesProp);
    useEffect(() => {
      setDates(normalizeDate(datesProp));
    }, [datesProp]);

    // set reference based on what the caller passed or date/dates.
    const [reference, setReference] = useState(
      normalizeReference(referenceProp, date, dates),
    );
    useEffect(
      () =>
        setReference(normalizeReference(referenceProp, dateProp, datesProp)),
      [dateProp, datesProp, referenceProp],
    );

    // normalize bounds
    const [bounds, setBounds] = useState(
      boundsProp ? boundsProp.map((b) => normalizeForTimezone(b)) : undefined,
    );
    useEffect(() => {
      if (boundsProp) setBounds(boundsProp.map((b) => normalizeForTimezone(b)));
      else setBounds(undefined);
    }, [boundsProp]);

    // calculate the bounds we display based on the reference
    const [displayBounds, setDisplayBounds] = useState(
      buildDisplayBounds(reference, firstDayOfWeek),
    );
    const [targetDisplayBounds, setTargetDisplayBounds] = useState();
    const [slide, setSlide] = useState();
    const [animating, setAnimating] = useState();

    // When the reference changes, we need to update the displayBounds.
    // This is easy when we aren't animating. If we are animating,
    // we temporarily increase the displayBounds to be the union of the old
    // and new ones and set slide to drive the animation. We keep track
    // of where we are heading via targetDisplayBounds. When the animation
    // finishes, we prune displayBounds down to where we are headed and
    // clear the slide and targetDisplayBounds.
    useEffect(() => {
      const nextDisplayBounds = buildDisplayBounds(reference, firstDayOfWeek);

      // Checks if the difference between the current and next DisplayBounds is
      // greater than a year. If that's the case, calendar should update without
      // animation.
      if (
        nextDisplayBounds[0].getTime() !== displayBounds[0].getTime() &&
        nextDisplayBounds[1].getTime() !== displayBounds[1].getTime()
      ) {
        let diffBoundsAboveYear = false;
        if (nextDisplayBounds[0].getTime() < displayBounds[0].getTime()) {
          if (
            displayBounds[0].getTime() - nextDisplayBounds[0].getTime() >
            millisecondsPerYear
          ) {
            diffBoundsAboveYear = true;
          }
        } else if (
          nextDisplayBounds[1].getTime() > displayBounds[1].getTime()
        ) {
          if (
            nextDisplayBounds[1].getTime() - displayBounds[1].getTime() >
            millisecondsPerYear
          ) {
            diffBoundsAboveYear = true;
          }
        }
        if (!animate || diffBoundsAboveYear) {
          setDisplayBounds(nextDisplayBounds);
        } else {
          setTargetDisplayBounds(nextDisplayBounds);
        }
      }
    }, [animate, firstDayOfWeek, reference, displayBounds]);

    useEffect(() => {
      if (targetDisplayBounds) {
        if (targetDisplayBounds[0].getTime() < displayBounds[0].getTime()) {
          // only animate if the duration is within a year
          if (
            displayBounds[0].getTime() - targetDisplayBounds[0].getTime() <
            millisecondsPerYear
          ) {
            setDisplayBounds([targetDisplayBounds[0], displayBounds[1]]);
            setSlide({
              direction: 'down',
              weeks: daysApart(displayBounds[0], targetDisplayBounds[0]) / 7,
            });
            setAnimating(true);
          }
        } else if (
          targetDisplayBounds[1].getTime() > displayBounds[1].getTime()
        ) {
          if (
            targetDisplayBounds[1].getTime() - displayBounds[1].getTime() <
            millisecondsPerYear
          ) {
            setDisplayBounds([displayBounds[0], targetDisplayBounds[1]]);
            setSlide({
              direction: 'up',
              weeks: daysApart(targetDisplayBounds[1], displayBounds[1]) / 7,
            });
            setAnimating(true);
          }
        }
        return undefined;
      }

      setSlide(undefined);
      return undefined;
    }, [animating, displayBounds, targetDisplayBounds]);

    // Last step in updating the displayBounds. Allows for pruning
    // displayBounds and cleaning up states to occur after animation.
    useEffect(() => {
      if (animating && targetDisplayBounds) {
        // Wait for animation to finish before cleaning up.
        const timer = setTimeout(
          () => {
            setDisplayBounds(targetDisplayBounds);
            setTargetDisplayBounds(undefined);
            setSlide(undefined);
            setAnimating(false);
          },
          400, // Empirically determined.
        );
        return () => clearTimeout(timer);
      }
      return undefined;
    }, [animating, targetDisplayBounds]);

    // We have to deal with reference being the end of a month with more
    // days than the month we are changing to. So, we always set reference
    // to the first of the month before changing the month.
    const previousMonth = useMemo(
      () => endOfMonth(subtractMonths(startOfMonth(reference), 1)),
      [reference],
    );
    const nextMonth = useMemo(
      () => startOfMonth(addMonths(startOfMonth(reference), 1)),
      [reference],
    );

    const daysRef = useRef();
    const [focus, setFocus] = useState();
    const [active, setActive] = useState();

    const changeReference = useCallback(
      (nextReference) => {
        if (betweenDates(nextReference, bounds)) {
          setReference(nextReference);
          if (onReference) onReference(nextReference.toISOString());
        }
      },
      [onReference, bounds],
    );
    const selectDate = useCallback(
      (selectedDate) => {
        let nextDates;
        let nextDate;
        // output date with no timestamp if that's how user provided it
        let adjustedDate;
        if (!range) {
          nextDate = selectedDate;
          if (datesProp) {
            datesProp.forEach((d) => {
              if (!timeStamp.test(d)) {
                adjustedDate = formatToLocalYYYYMMDD(nextDate);
                if (d === adjustedDate) {
                  nextDate = undefined;
                } else {
                  adjustedDate = undefined;
                }
              }
            });
          } else if (typeof dateProp === 'string') {
            if (!timeStamp.test(dateProp)) {
              adjustedDate = formatToLocalYYYYMMDD(selectedDate);
              if (dateProp === adjustedDate) {
                nextDate = undefined;
              } else {
                adjustedDate = undefined;
              }
            }
          } else if (Array.isArray(dateProp)) {
            dateProp.forEach((d) => {
              if (!timeStamp.test(d)) {
                adjustedDate = formatToLocalYYYYMMDD(nextDate);
                if (d === adjustedDate) {
                  nextDate = undefined;
                } else {
                  adjustedDate = undefined;
                }
              }
            });
          } else {
            adjustedDate = undefined;
          }
        }
        // everything down is a range
        else if (!dates && !Array.isArray(date)) {
          // if user supplies date, convert this into dates
          if (date) {
            const priorDate = new Date(date);
            const selDate = new Date(selectedDate);
            if (activeDate === activeDates.start) {
              if (selDate.getTime() > priorDate.getTime()) {
                nextDates = [[selectedDate, undefined]];
              } else {
                nextDates = [[selectedDate, date]];
              }
              setActiveDate(activeDates.end);
              if (activeDateProp) setActiveDate(activeDateProp);
            } else if (activeDate === activeDates.end) {
              if (selDate.getTime() < priorDate.getTime()) {
                nextDates = [[selectedDate, undefined]];
                setActiveDate(activeDates.end);
              } else {
                nextDates = [[date, selectedDate]];
                setActiveDate(activeDates.start);
              }
              if (activeDateProp) setActiveDate(activeDateProp);
            }
          } else if (activeDate === activeDates.start) {
            nextDates = [[selectedDate, undefined]];
            setActiveDate(activeDates.end);
          } else if (activeDate === activeDates.end) {
            nextDates = [[undefined, selectedDate]];
          }
          if (activeDateProp) setActiveDate(activeDateProp);
        } else if (dates || date) {
          const handleSelection = (dateValue) => {
            const priorDates = dateValue[0].map((d) => new Date(d));
            const selDate = new Date(selectedDate);
            if (selDate.getTime() === priorDates[0].getTime()) {
              nextDates = [[undefined, dateValue[0][1]]];
              setActiveDate(activeDates.start);
            } else if (selDate.getTime() === priorDates[1].getTime()) {
              nextDates = [[dateValue[0][0], undefined]];
              setActiveDate(activeDates.end);
              if (activeDateProp) setActiveDate(activeDateProp);
            } else if (activeDate === activeDates.start) {
              if (selDate.getTime() > priorDates[1].getTime()) {
                nextDates = [[selectedDate, undefined]];
              } else {
                nextDates = [[selectedDate, dateValue[0][1]]];
              }
              setActiveDate(activeDates.end);
              if (activeDateProp) setActiveDate(activeDateProp);
            } else if (activeDate === activeDates.end) {
              if (selDate.getTime() < priorDates[0].getTime()) {
                nextDates = [[selectedDate, undefined]];
                setActiveDate(activeDates.end);
              } else {
                nextDates = [[dateValue[0][0], selectedDate]];
                setActiveDate(activeDates.start);
              }
              if (activeDateProp) setActiveDate(activeDateProp);
            }
            // cleanup
            if (!nextDates[0][0] && !nextDates[0][1]) nextDates = undefined;
          };
          // have dates
          if (dates) {
            handleSelection(dates);
          } else if (date && Array.isArray(date)) {
            handleSelection(date);
          }
        }

        setDates(nextDates);
        if (date && typeof date === 'string') {
          setDate(nextDate);
        } else if (date && Array.isArray(date)) {
          setDate(nextDates);
        }
        setActive(new Date(selectedDate));
        if (onSelect) {
          let adjustedDates;
          if (
            nextDates &&
            Array.isArray(nextDates[0]) &&
            (!nextDates[0][0] || !nextDates[0][1]) &&
            range === true
          ) {
            // return string for backwards compatibility
            [adjustedDates] = nextDates[0].filter((d) => d);
          } else {
            adjustedDates = nextDates;
          }
          onSelect(adjustedDates || adjustedDate || nextDate);
        }
      },
      [
        activeDate,
        activeDateProp,
        date,
        dateProp,
        dates,
        datesProp,
        onSelect,
        range,
      ],
    );

    const renderCalendarHeader = () => {
      const PreviousIcon =
        size === 'small'
          ? theme.calendar.icons.small.previous
          : theme.calendar.icons.previous;

      const NextIcon =
        size === 'small'
          ? theme.calendar.icons.small.next
          : theme.calendar.icons.next;

      return (
        <Box direction="row" justify="between" align="center">
          <Box flex pad={{ horizontal: headingPadMap[size] || 'small' }}>
            <Heading
              level={
                size === 'small'
                  ? (theme.calendar.heading && theme.calendar.heading.level) ||
                    4
                  : ((theme.calendar.heading && theme.calendar.heading.level) ||
                      4) - 1
              }
              size={size}
              margin="none"
            >
              {reference.toLocaleDateString(locale, {
                month: 'long',
                year: 'numeric',
              })}
            </Heading>
          </Box>
          <Box flex={false} direction="row" align="center">
            <Button
              a11yTitle={previousMonth.toLocaleDateString(locale, {
                month: 'long',
                year: 'numeric',
              })}
              icon={<PreviousIcon size={size !== 'small' ? size : undefined} />}
              disabled={!betweenDates(previousMonth, bounds)}
              onClick={() => {
                changeReference(previousMonth);
                announce(
                  format({
                    id: 'calendar.previous',
                    messages,
                    values: {
                      date: previousMonth.toLocaleDateString(locale, {
                        month: 'long',
                        year: 'numeric',
                      }),
                    },
                  }),
                );
              }}
            />
            <Button
              a11yTitle={nextMonth.toLocaleDateString(locale, {
                month: 'long',
                year: 'numeric',
              })}
              icon={<NextIcon size={size !== 'small' ? size : undefined} />}
              disabled={!betweenDates(nextMonth, bounds)}
              onClick={() => {
                changeReference(nextMonth);
                announce(
                  format({
                    id: 'calendar.next',
                    messages,
                    values: {
                      date: nextMonth.toLocaleDateString(locale, {
                        month: 'long',
                        year: 'numeric',
                      }),
                    },
                  }),
                );
              }}
            />
          </Box>
        </Box>
      );
    };

    const renderDaysOfWeek = () => {
      let day = new Date(displayBounds[0]);
      const days = [];
      while (days.length < 7) {
        days.push(
          <StyledDayContainer
            role="gridcell"
            key={days.length}
            sizeProp={size}
            fillContainer={fill}
          >
            <StyledDay otherMonth sizeProp={size} fillContainer={fill}>
              {day.toLocaleDateString(locale, { weekday: 'narrow' })}
            </StyledDay>
          </StyledDayContainer>,
        );
        day = addDays(day, 1);
      }
      return <StyledWeek role="row">{days}</StyledWeek>;
    };

    const weeks = [];
    let day = new Date(displayBounds[0]);
    let days;
    let firstDayInMonth;
    let blankWeek = false;

    while (day.getTime() < displayBounds[1].getTime()) {
      if (day.getDay() === firstDayOfWeek) {
        if (days) {
          weeks.push(
            <StyledWeek role="row" key={day.getTime()} fillContainer={fill}>
              {days}
            </StyledWeek>,
          );
        }
        days = [];
      }

      const otherMonth = day.getMonth() !== reference.getMonth();
      if (!showAdjacentDays && otherMonth) {
        days.push(
          <StyledDayContainer
            key={day.getTime()}
            sizeProp={size}
            fillContainer={fill}
          >
            <StyledDay sizeProp={size} fillContainer={fill} />
          </StyledDayContainer>,
        );

        if (
          weeks.length === 5 &&
          /* If the length days array is less than the current getDate()
          we know that all days in the array are from the next month. */
          days.length < day.getDate()
        ) {
          blankWeek = true;
        }
      } else if (
        /* Do not show adjacent days in 6th row if all days
        fall in the next month */
        showAdjacentDays === 'trim' &&
        otherMonth &&
        weeks.length === 5 &&
        /* If the length days array is less than the current getDate()
        we know that all days in the array are from the next month. */
        days.length < day.getDate()
      ) {
        blankWeek = true;
        days.push(
          <StyledDayContainer
            key={day.getTime()}
            sizeProp={size}
            fillContainer={fill}
          >
            <StyledDay sizeProp={size} fillContainer={fill} />
          </StyledDayContainer>,
        );
      } else {
        const dateString = day.toISOString();
        // this.dayRefs[dateString] = React.createRef();
        let selected = false;
        let inRange = false;

        const selectedState = withinDates(day, date || dates);
        if (selectedState === 2) {
          selected = true;
        } else if (selectedState === 1) {
          inRange = true;
        }
        const dayDisabled =
          withinDates(day, disabled) || (bounds && !betweenDates(day, bounds));
        if (
          !firstDayInMonth &&
          !dayDisabled &&
          day.getMonth() === reference.getMonth()
        ) {
          firstDayInMonth = dateString;
        }

        if (!children) {
          days.push(
            <CalendarDay
              key={day.getTime()}
              buttonProps={{
                a11yTitle: day.toDateString(),
                active: active && active.getTime() === day.getTime(),
                disabled: dayDisabled && !!dayDisabled,
                onClick: () => {
                  selectDate(dateString);
                  announce(
                    `Selected ${formatToLocalYYYYMMDD(dateString)}`,
                    'assertive',
                  );
                  // Chrome moves the focus indicator to this button. Set
                  // the focus to the grid of days instead.
                  daysRef.current.focus();
                },
                onMouseOver: () => setActive(new Date(dateString)),
                onMouseOut: () => setActive(undefined),
              }}
              isInRange={inRange}
              isSelected={selected}
              otherMonth={day.getMonth() !== reference.getMonth()}
              size={size}
              fill={fill}
            >
              {day.getDate()}
            </CalendarDay>,
          );
        } else {
          days.push(
            <CalendarCustomDay
              key={day.getTime()}
              buttonProps={
                onSelect
                  ? {
                      a11yTitle: day.toDateString(),
                      active: active && active.getTime() === day.getTime(),
                      disabled: dayDisabled && !!dayDisabled,
                      onClick: () => {
                        selectDate(dateString);
                        announce(
                          `Selected 
                          ${formatToLocalYYYYMMDD(dateString)}`,
                          'assertive',
                        );
                        // Chrome moves the focus indicator to this button. Set
                        // the focus to the grid of days instead.
                        daysRef.current.focus();
                      },
                      onMouseOver: () => setActive(new Date(dateString)),
                      onMouseOut: () => setActive(undefined),
                    }
                  : null
              }
              size={size}
              fill={fill}
            >
              {children({
                date: day,
                day: day.getDate(),
                isInRange: inRange,
                isSelected: selected,
              })}
            </CalendarCustomDay>,
          );
        }
      }
      day = addDays(day, 1);
    }
    weeks.push(
      <StyledWeek
        // if a week contains only blank days, for screen reader accessibility
        // we don't want to set role="row"
        role={!blankWeek ? 'row' : undefined}
        key={day.getTime()}
        fillContainer={fill}
      >
        {days}
      </StyledWeek>,
    );

    return (
      <StyledCalendar ref={ref} sizeProp={size} fillContainer={fill} {...rest}>
        <Box fill={fill}>
          {header
            ? header({
                date: reference,
                locale,
                onPreviousMonth: () => {
                  changeReference(previousMonth);
                  announce(
                    format({
                      id: 'calendar.previous',
                      messages,
                      values: {
                        date: previousMonth.toLocaleDateString(locale, {
                          month: 'long',
                          year: 'numeric',
                        }),
                      },
                    }),
                  );
                },
                onNextMonth: () => {
                  changeReference(nextMonth);
                  announce(
                    format({
                      id: 'calendar.next',
                      messages,
                      values: {
                        date: nextMonth.toLocaleDateString(locale, {
                          month: 'long',
                          year: 'numeric',
                        }),
                      },
                    }),
                  );
                },
                previousInBound: betweenDates(previousMonth, bounds),
                nextInBound: betweenDates(nextMonth, bounds),
              })
            : renderCalendarHeader(previousMonth, nextMonth)}
          {daysOfWeek && renderDaysOfWeek()}
          <Keyboard
            onEnter={() =>
              active !== undefined
                ? selectDate(active.toISOString())
                : undefined
            }
            onUp={(event) => {
              event.preventDefault();
              event.stopPropagation(); // so the page doesn't scroll
              setActive(addDays(active, -7));
            }}
            onDown={(event) => {
              event.preventDefault();
              event.stopPropagation(); // so the page doesn't scroll
              setActive(addDays(active, 7));
            }}
            onLeft={() => active && setActive(addDays(active, -1))}
            onRight={() => active && setActive(addDays(active, 1))}
          >
            <StyledWeeksContainer
              tabIndex={0}
              role="grid"
              aria-label={reference.toLocaleDateString(locale, {
                month: 'long',
                year: 'numeric',
              })}
              ref={daysRef}
              sizeProp={size}
              fillContainer={fill}
              focus={focus}
              onFocus={() => {
                setFocus(true);
                if (date && betweenDates(new Date(date), displayBounds)) {
                  setActive(new Date(date));
                } else {
                  setActive(new Date(firstDayInMonth));
                }
              }}
              onBlur={() => {
                setFocus(false);
                setActive(undefined);
              }}
            >
              <StyledWeeks slide={slide} sizeProp={size} fillContainer={fill}>
                {weeks}
              </StyledWeeks>
            </StyledWeeksContainer>
          </Keyboard>
        </Box>
      </StyledCalendar>
    );
  },
);

Calendar.displayName = 'Calendar';

let CalendarDoc;
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line global-require
  CalendarDoc = require('./doc').doc(Calendar);
}
const CalendarWrapper = CalendarDoc || Calendar;

export { CalendarWrapper as Calendar };
