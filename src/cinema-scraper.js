/**
 * The cinema scraper module.
 *
 * @author Beatriz Sanssi <bs222eh@student.lnu.se>
 * @version 1.0.0
 */

const axios = require('axios')
const cheerio = require('cheerio')

// Mapping over day codes
const dayMapping = {
  '05': 'Friday',
  '06': 'Saturday',
  '07': 'Sunday'
}

/**
 * Fetches the current list of movies and their codes.
 *
 * @param {string} baseUrl - The base URL of the scraping site.
 * @returns {Promise<object>} A promise that resolves to an object mapping movie codes to titles.
 */
async function fetchMovieTitles (baseUrl) {
  const url = `${baseUrl}/cinema`

  try {
    const response = await axios.get(url)
    const html = response.data
    const $ = cheerio.load(html)
    const movieTitles = {}

    const movieOptions = $('#movie option').toArray().slice(1)

    movieOptions.forEach(option => {
      const value = $(option).val()
      const text = $(option).text().trim()
      if (value && text) {
        movieTitles[value] = text
      }
    })

    return movieTitles
  } catch (error) {
    console.error(`Error fetching movie titles: ${error.message}`)
    return {}
  }
}

/**
 * Scrapes the cinema page.
 *
 * @param {string} baseUrl - The base URL of the scraping site.
 * @returns {Promise<object[]>} A promise that resolves in to an array of movie showtimes.
 */
async function scrapeCinemaPage (baseUrl) {
  const days = ['05', '06', '07']
  const movieTitles = await fetchMovieTitles(baseUrl)

  const showtimesPromises = days.flatMap(day =>
    Object.keys(movieTitles).map(movie =>
      fetchAndProcessMovieShowtimes(baseUrl, day, movie, movieTitles))
  )
  // Combine all showtimes into a single array
  return Promise.all(showtimesPromises)
    .then(allShowtimes => allShowtimes.flat())
    .catch(error => {
      console.error(`Error scraping cinema page: ${error}`)
      return []
    })
}

/**
 * Processes movie showtimes and availability details.
 *
 * @param {object[]} data - The movie showtimes and availability details.
 * @param {object} movieTitles - The movie titles.
 * @returns {object[]} An array of processed movie showtimes.
 */
function processMovieShowtimes (data, movieTitles) {
  return data.map(showtime => {
    const dayName = dayMapping[showtime.day] || `Day code: ${showtime.day}`
    const movieName = movieTitles[showtime.movie] || `Movie code: ${showtime.movie}`
    const availability = showtime.status === 1 ? 'Available' : 'Fully Booked'

    return {
      day: dayName,
      time: showtime.time,
      movie: movieName,
      availability
    }
  })
}

/**
 * Fetches and processes movie showtimes.
 *
 * @param {string} baseUrl - The base URL of the scraping site.
 * @param {string} day - The day parameter.
 * @param {string} movie - The movie parameter.
 * @param {object} movieTitles - The movie titles.
 * @returns {Promise<object[]>} A promise that resolves to an array of movie showtimes.
 */
async function fetchAndProcessMovieShowtimes (baseUrl, day, movie, movieTitles) {
  const url = `${baseUrl}/cinema/check?day=${day}&movie=${movie}`
  try {
    const response = await axios.get(url)
    if (Array.isArray(response.data)) {
      return processMovieShowtimes(response.data, movieTitles)
    } else {
      console.error(`Unexpected response format for URL ${url}:`, response.data)
      return []
    }
  } catch (error) {
    console.error(`Error fetching movie showtimes from URL ${url}:`, error.message)
    console.error('Error details:', error)
    throw error
  }
}

module.exports = { scrapeCinemaPage }
