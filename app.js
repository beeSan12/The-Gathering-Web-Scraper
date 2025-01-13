/**
 * The starting point of the application.
 *
 * @author Beatriz Sanssi <bs222eh@student.lnu.se>
 * @version 1.0.0
 */
const axios = require('axios')
const cheerio = require('cheerio')

const { processCalendarPage } = require('./src/calender-scraper.js')
const { scrapeCinemaPage } = require('./src/cinema-scraper')
const { scrapeRestaurantPage } = require('./src/restaurant-scraper')

const startUrl = process.argv[2] || 'https://courselab.lnu.se/scraper-site-1/'

/**
 * Scrapes all necessary data from the URL.
 *
 * @param {string} url - The URL to scrape.
 * @returns {Promise<Array>} A promise that resolves to an array of links.
 */
async function scrapeURL (url) {
  try {
    const response = await axios.get(url)
    const html = response.data
    const $ = cheerio.load(html)

    // Scrape the different pages, starting with the calendar page
    if (url.endsWith('/calendar/')) {
      // Find individual calendar links on the main calendar page
      const calendarLinks = $('a').map((i, el) => $(el).attr('href')).get()
      return Promise.all(calendarLinks.map(link => scrapeURL(new URL(link, url).href)))

      // Scrape each individual calendar link
    } else if (url.match(/(paul|paul3|peter|mary|mary3)\.html$/)) {
      // Process individual calendar pages
      return processCalendarPage(html)

      // Scrape the cinema page
    } else if (url.endsWith('/cinema')) {
      return scrapeCinemaPage(startUrl)

      // Scrape the restaurant page
    } else if (url.endsWith('/dinner/')) {
      return scrapeRestaurantPage(startUrl)
    }
  } catch (error) {
    console.error(`Error scraping ${url}: ${error.message}`)
    return [] // Return an empty array on error
  }
}

/**
 * Find the common available days for all persons.
 *
 * @param {object[]} calendarData - The calendar data.
 * @returns {string[]} An array of common available days.
 */
function findCommonAvailableDays (calendarData) {
  const daysOfWeek = ['Friday', 'Saturday', 'Sunday']

  return daysOfWeek.filter(day => {
    return calendarData.every(calendar => {
      if (calendar && typeof calendar[day] !== 'undefined') {
        return calendar[day] === true
      } else {
        console.error(`Missing or invalid data for day: ${day}`)
        return false
      }
    })
  })
}

/**
 * The main function for running the application.
 */
async function main () {
  try {
    const response = await axios.get(startUrl)
    const html = response.data
    const $ = cheerio.load(html)
    const links = $('a').map((i, el) => $(el).attr('href')).get()

    const scrapedData = await Promise.all(links.map(link => scrapeURL(new URL(link, startUrl).href)))

    // Extract the calendar data from the scraped data and find common available days
    const calendarData = scrapedData[0]
    const commonDays = findCommonAvailableDays(calendarData)

    // Check if commonDays is empty
    if (commonDays.length === 0) {
      console.log('No available day was found')
    } else {
      // Scrape the cinema and restaurant pages
      const restaurantReservations = await scrapeRestaurantPage(startUrl)
      const movieShowtimes = scrapedData[1]

      // Find suitable combinations
      const suggestions = findSuitableCombinations(movieShowtimes, restaurantReservations, commonDays)
      console.log('Suggestions\n===========\n' + suggestions.join('\n'))
    }
  } catch (err) {
    console.error('Error during scraping:', err)
  }
}

/**
 * Finds suitable combinations of each persons calender,
 * The movie showtimes and available sitting for dinner.
 *
 * @param {object[]} movieShowtimes - The movie showtimes.
 * @param {object[]} restaurantReservations - The restaurant reservations.
 * @param {object[]} commonDays - The common available days.
 * @returns {object[]} An array of suitable combinations.
 */
function findSuitableCombinations (movieShowtimes, restaurantReservations, commonDays) {
  if (!movieShowtimes || !restaurantReservations) {
    console.error('Missing data for movie showtimes or restaurant reservations')
    return []
  }
  const suggestions = []

  commonDays.forEach(day => {
    if (typeof day !== 'string') {
      console.error('Day is not a string:', day)
      return
    }
    // Filter showtimes and reservations for the common day
    const dayShowtimes = movieShowtimes.filter(showtime => showtime.day === day && showtime.availability === 'Available')
    const dayShort = day.toLowerCase().substring(0, 3) // 'Friday' -> 'fri'
    const dayReservations = restaurantReservations.filter(reservation =>
      reservation.timeValue && reservation.timeValue.startsWith(dayShort) &&
      reservation.availability === 'Available')

    // For each showtime, find a corresponding reservation
    dayShowtimes.forEach(showtime => {
      dayReservations.forEach(reservation => {
      // Assuming movie duration is 2 hours for simplicity
        const movieEndTime = addHoursToShowtime(showtime.time, 2)
        if (isTimeBefore(movieEndTime, reservation.timeValue)) {
          suggestions.push({
            day,
            movie: showtime.movie,
            movieStartTime: showtime.time,
            reservationTime: reservation.timeValue
          })
        }
      })
    })
  })

  return formatSuggestions(suggestions)
}

/**
 * Adds hours to a showtime.
 *
 * @param {*} time - The showtime.
 * @param {*} hours - The hours to add.
 * @returns {string} The showtime with the added hours.
 */
function addHoursToShowtime (time, hours) {
  let [hoursPart, minutesPart] = time.split(':').map(Number)
  hoursPart += hours
  if (hoursPart >= 24) hoursPart -= 24 // Adjust for times past midnight
  return `${hoursPart.toString().padStart(2, '0')}:${minutesPart.toString().padStart(2, '0')}`
}

/**
 * Checks if the showtime and the available restaurant slots do not collide.
 *
 * @param {object[]} movieEndTime The movie end time.
 * @param {object[]} reservationTimeValue The reservation time.
 * @returns {boolean} True if the showtime is before the available restaurant slot.
 */
function isTimeBefore (movieEndTime, reservationTimeValue) {
  const reservationTime = reservationTimeValue.substring(3) // Extract time part, e.g., '1416' from 'fri1416'
  const [resHours, resMinutes] = reservationTime.match(/.{1,2}/g).map(Number) // Split '1416' into ['14', '16']
  const [movieEndHours, movieEndMinutes] = movieEndTime.split(':').map(Number)

  return movieEndHours < resHours || (movieEndHours === resHours && movieEndMinutes < resMinutes)
}

/**
 * Formats the suggestions.
 *
 * @param {object[]} suggestions - The suggestions.
 * @returns {object[]} An array of formatted suggestions.
 */
function formatSuggestions (suggestions) {
  // Format the suggestions for readability
  return suggestions.map(suggestion => {
    // Extract hours from the reservation time string
    const reservationStart = suggestion.reservationTime.slice(3, 5)
    const reservationEnd = suggestion.reservationTime.slice(5, 7)

    return `* On ${suggestion.day}, "${suggestion.movie}" begins at ${suggestion.movieStartTime}, and there is a free table to book between ${reservationStart}:00-${reservationEnd}:00.`
  })
}

main()
