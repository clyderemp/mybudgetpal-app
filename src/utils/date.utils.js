// src/utils/date.utils.js

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import duration from "dayjs/plugin/duration";

dayjs.extend(relativeTime);
dayjs.extend(duration);

class DateUtils {
  getDaysAgo(date) {
    return dayjs(date).fromNow();
  }

  getDaysFromNow(date) {
    return dayjs().to(dayjs(date));
  }

  getAge(birthDate) {
    return dayjs().diff(dayjs(birthDate), "year");
  }

  getDateString(date, format = "YYYY-MM-DD") {
    return dayjs(date).format(format);
  }

  getFormattedDateString(date) {
    return dayjs(date).format("MMMM D, YYYY"); // Example: July 13, 2025
  }

  getDifference(date1, date2, unit = "day") {
    return dayjs(date1).diff(dayjs(date2), unit);
  }
}

export const useDateUtils = new DateUtils();
