/**
 * The calender scraper module.
 *
 * @author Beatriz Sanssi <bs222eh@student.lnu.se>
 * @version 1.0.0
 */

const cheerio = require('cheerio')

/**
 * Processes the calendar page to find available days.
 *
 * @param {string} html - The HTML content of the calendar page.
 * @returns {object} An object with days as keys and availability as boolean values.
 */
function processCalendarPage (html) {
  const $ = cheerio.load(html)
  const daysAvailable = {
    Friday: false,
    Saturday: false,
    Sunday: false
  }

  $('table.centered.striped.responsive-table tbody tr td').each((index, element) => {
    const availability = $(element).text().trim().toLowerCase()
    const dayOfWeek = Object.keys(daysAvailable)[index]

    // Mark the day as available if the text is 'ok' or 'OK', and not '--' or '-'
    daysAvailable[dayOfWeek] = (availability === 'ok' || availability === 'OK') && (availability !== '--' && availability !== '-')
  })

  return daysAvailable
}

module.exports = { processCalendarPage }
