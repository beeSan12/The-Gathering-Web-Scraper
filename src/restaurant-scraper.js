/**
 * The restaurant scraper module.
 *
 * @author Beatriz Sanssi <bs222eh@student.lnu.se>
 * @version 1.0.0
 */

const cheerio = require('cheerio')
const axios = require('axios').default
const { CookieJar } = require('tough-cookie')
const { wrapper } = require('axios-cookiejar-support')

// Create an axios instance with cookie support
const cookieJar = new CookieJar()
const client = wrapper(axios.create({ jar: cookieJar, withCredentials: true }))

/**
 * Performs login and updates the global cookie.
 *
 * @param {string} loginUrl - The login URL.
 * @returns {Promise<boolean>} A promise that resolves to true if login is successful, false otherwise.
 */
async function login (loginUrl) {
  try {
  // Get the login page to extract the CSRF token
    const loginPageResponse = await client.get(loginUrl)
    const $ = cheerio.load(loginPageResponse.data)
    const csrfToken = $('input[name="csrf_token"]').val()

    // Prepare the login data
    const loginData = new URLSearchParams({
      username: 'zeke',
      password: 'coys',
      submit: 'login',
      csrf_token: csrfToken
    })

    // Send the login request
    const loginResponse = await client.post(
      loginUrl, loginData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

    // Check if login was successful
    return loginResponse.status === 200
  } catch (error) {
    console.error('Error during login:', error)
    return false
  }
}

/**
 * Scrapes the restaurant page for available slots.
 *
 * @param {string} baseUrl - The base URL of the scraping site.
 * @returns {Promise<object[]>} A promise that resolves to an array of available slots.
 */
async function scrapeRestaurantPage (baseUrl) {
  // Dynamically construct the URLs based on the base URL
  const loginUrl = `${baseUrl}/dinner/login`
  const protectedPageUrl = `${baseUrl}/dinner/login/booking`

  if (!await login(loginUrl)) {
    console.error('Login failed, cannot scrape restaurant page.')
    return []
  }

  try {
    const response = await client.get(protectedPageUrl)
    return processRestaurantPage(response.data)
  } catch (error) {
    console.error('Error scraping restaurant page:', error)
    return []
  }
}

/**
 * Process the restaurant page to find available slots.
 *
 * @param {string} html - The HTML to process.
 * @returns {object[]} An array of available slots.
 */
function processRestaurantPage (html) {
  if (typeof html !== 'string') {
    console.error('Invalid HTML data received:', html)
    return []
  }
  const $ = cheerio.load(html)
  const availability = []

  // Loop through each reservation slot
  $('p.MsoNormal').each((index, element) => {
    const timeSlot = $(element).text().trim()
    let status

    if (timeSlot.includes('Free')) {
      status = 'Available'
    } else if (timeSlot.includes('Fully booked')) {
      status = 'Fully booked'
    }

    if (status) {
      const value = $(element).find('input[type="radio"]').val()
      availability.push({
        timeValue: value,
        availability: status
      })
    }
  })

  return availability
}

module.exports = { scrapeRestaurantPage }
