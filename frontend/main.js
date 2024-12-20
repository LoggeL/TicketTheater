const isAdminPage = window.location.pathname.includes('admin.html')
const isIndexPage =
  window.location.pathname.includes('index.html') ||
  window.location.pathname.endsWith('/')

const API_URL = 'api'
const unlockDate = new Date('2024-12-04T13:00:00+02:00')

// Index page specific code
if (isIndexPage) {
  const countdownNotice = document.getElementById('countdownNotice')

  if (unlockDate > new Date()) {
    countdownNotice.style.display = 'block'
    countdownNotice.innerText = `Tickets erst ab ${unlockDate.toLocaleString()} verfügbar.`

    // Disable all forms
    document.querySelectorAll('form').forEach((form) => {
      form.querySelectorAll('input, button, select').forEach((element) => {
        element.disabled = true
        element.style.cursor = 'not-allowed'
      })
    })
  }

  // Other index.html specific functions
  const submitButton = document.getElementById('submit')
  function captchaCallback() {
    if (unlockDate > new Date()) {
      submitButton.disabled = true
      return
    }
    submitButton.disabled = false
  }

  if (unlockDate > new Date()) {
    setInterval(() => {
      const diff = unlockDate - new Date()
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      )
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      const formattedTime = `${days.toString().padStart(2, '0')}:${hours
        .toString()
        .padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`
      submitButton.innerText = `Countdown: (${formattedTime})`
      if (diff <= 0) {
        window.location.reload(true)
      }
    }, 1000)
  } else {
    fillShowSelect()
      .then(() => {
        document.getElementById('show').disabled = false
      })
      .catch((err) => {
        console.error(err)
      })
  }
}

// Shared functions that both pages use
function displayError(e) {
  const snackbarError = document.getElementById('snackbarError')
  snackbarError.classList.add('active')
  snackbarError.innerHTML = e
  console.error(e)
  setTimeout(() => {
    snackbarError.classList.remove('active')
  }, 5000)
}

function displaySuccess(e) {
  const snackbarSuccess = document.getElementById('snackbarSuccess')
  snackbarSuccess.classList.add('active')
  snackbarSuccess.innerHTML = e
  console.log(e)
  setTimeout(() => {
    snackbarSuccess.classList.remove('active')
  }, 5000)
}

function bookTicket(event) {
  event.preventDefault()

  console.log('submitting form')

  // Check if the form is valid
  if (!event.target.checkValidity()) {
    return displayError('Bitte fülle alle Felder korrekt aus.')
  }

  //   Check if captcha is valid
  const captcha = turnstile.getResponse()
  if (!captcha) {
    return displayError('Bitte bestätige, dass du kein Roboter bist.')
  }

  // Get selected seats
  const seats = []
  const selectedSeats = document.querySelectorAll('.seat.selected')
  selectedSeats.forEach((seat) => {
    seats.push(seat.innerText)
  })

  if (seats.length === 0) {
    return displayError('Bitte wähle mindestens einen Sitzplatz aus.')
  }

  // Check if the user has selected more than 5 seats
  if (seats.length > 5) {
    return displayError('Du kannst maximal 5 Sitzplätze auswählen.')
  }

  // Disable submit button
  const submitButton = document.getElementById('submit')
  submitButton.disabled = true

  //   Send form data to backend
  const formData = new FormData(event.target)
  formData.append('seats', JSON.stringify(seats))
  const data = Object.fromEntries(formData.entries())
  console.log(data)
  fetch(`${API_URL}/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
    .then((response) => {
      // Check for errors that the server might have sent
      response
        .json()
        .then((data) => {
          if (data.error) {
            displayError(data.error)
          } else if (data.message) {
            displaySuccess(data.message)
            setTimeout(() => {
              window.location.href = `info.html#${data.ticketId}`
            }, 3000)
          } else {
            displayError(
              'Beim Senden deiner Nachricht ist ein Fehler aufgetreten.'
            )
          }
          submitButton.disabled = false
        })
        .catch((error) => {
          displayError(
            'Beim Senden deiner Nachricht ist ein Fehler aufgetreten: ' + error
          )
          submitButton.disabled = false
        })
    })
    .catch((error) => {
      displayError(
        'Beim Senden deiner Nachricht ist ein Fehler aufgetreten: ' + error
      )
      submitButton.disabled = false
    })
}

function stornoTicket(event) {
  event.preventDefault()

  console.log('submitting form')

  // Check if the form is valid
  if (!event.target.checkValidity()) {
    return displayError('Bitte fülle alle Felder korrekt aus.')
  }

  // Send form data to backend
  const formData = new FormData(event.target)
  const data = Object.fromEntries(formData.entries())
  fetch(`${API_URL}/tickets/${data.ticketId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then((response) => {
      // Check for errors that the server might have sent
      response
        .json()
        .then((data) => {
          if (data.error) {
            displayError(data.error)
          } else if (data.message) {
            displaySuccess(data.message)
            setTimeout(() => {
              window.location.href = `index.html`
            }, 3000)
          } else {
            displayError(
              'Beim Senden deiner Nachricht ist ein Fehler aufgetreten.'
            )
          }
        })
        .catch((error) => {
          displayError(
            'Beim Senden deiner Nachricht ist ein Fehler aufgetreten: ' + error
          )
        })
    })
    .catch((error) => {
      displayError(
        'Beim Senden deiner Nachricht ist ein Fehler aufgetreten: ' + error
      )
    })
}

function getTicket(event) {
  event.preventDefault()

  console.log('submitting form')

  // Check if the form is valid
  if (!event.target.checkValidity()) {
    return displayError('Bitte fülle alle Felder korrekt aus.')
  }

  // Send form data to backend
  const ticketId = document.getElementById('ticketId').value
  fetch(`${API_URL}/tickets/${ticketId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then((response) => {
      // Check for errors that the server might have sent
      response
        .json()
        .then((data) => {
          if (data.error) {
            displayError(data.error)
          } else if (data.message) {
            displaySuccess(data.message)
            displayTicketData(data)
          } else {
            displayError(
              'Beim Senden deiner Nachricht ist ein Fehler aufgetreten.'
            )
          }
        })
        .catch((error) => {
          displayError(
            'Beim Senden deiner Nachricht ist ein Fehler aufgetreten: ' + error
          )
        })
    })
    .catch((error) => {
      displayError(
        'Beim Senden deiner Nachricht ist ein Fehler aufgetreten: ' + error
      )
    })
}

function getTickets(event) {
  event.preventDefault()

  console.log('submitting form')

  // Check if the form is valid
  if (!event.target.checkValidity()) {
    return displayError('Bitte fülle alle Felder korrekt aus.')
  }

  // Send form data to backend
  const password = document.getElementById('password').value
  fetch(`${API_URL}/tickets`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Password': password,
    },
  })
    .then((response) => {
      // Check for errors that the server might have sent
      response
        .json()
        .then((data) => {
          if (data.error) {
            displayError(data.error)
          } else if (data.message) {
            displaySuccess(data.message)
            displayTickets(data)
          } else {
            displayError(
              'Beim Senden deiner Nachricht ist ein Fehler aufgetreten.'
            )
          }
        })
        .catch((error) => {
          displayError(
            'Beim Senden deiner Nachricht ist ein Fehler aufgetreten: ' + error
          )
        })
    })
    .catch((error) => {
      displayError(
        'Beim Senden deiner Nachricht ist ein Fehler aufgetreten: ' + error
      )
    })
}

let bookedSeats = []
const seatCounterNumber = document.getElementById('seatCounterNumber')

function displaySeats(show, seats, interactive = true) {
  console.log(show, seats)
  const seatContainer = document.getElementById('seatContainer')
  seatContainer.innerHTML =
    '<div class="grid"><div class="s12 stage">Bühne</div></div>'

  for (let row = 0; row < parseInt(show.rows); row++) {
    const rowElement = document.createElement('div')
    rowElement.classList.add('grid', 'no-space')
    const spacer = 12 - show.seats
    for (let seat = 0; seat < parseInt(show.seats); seat++) {
      // Spacer in the middle
      if (seat === Math.floor(show.seats / 2)) {
        for (let i = 0; i < spacer; i++) {
          const spacerElement = document.createElement('div')
          spacerElement.classList.add()
          rowElement.appendChild(spacerElement)
        }
      }
      const seatElement = document.createElement('div')
      seatElement.classList.add('seat')
      if (
        seats.find((seatData) => seatData.row == row && seatData.seat == seat)
      ) {
        seatElement.classList.add('booked')
      }
      seatElement.addEventListener('click', () => {
        if (!interactive) {
          return
        }
        if (seatElement.classList.contains('selected')) {
          seatElement.classList.remove('selected')
          bookedSeats.splice(bookedSeats.indexOf(seatElement.innerText), 1)
          seatCounterNumber.innerText =
            document.querySelectorAll('.seat.selected').length
          if (seatCounterNumber.innerText <= 5) {
            seatCounterNumber.parentElement.classList.remove('yellow')
          }
        } else if (seatElement.classList.contains('booked')) {
          return
        } else {
          if (document.querySelectorAll('.seat.selected').length >= 5) {
            return
          }
          seatElement.classList.add('selected')
          bookedSeats.push(seatElement.innerText)
          seatCounterNumber.innerText =
            document.querySelectorAll('.seat.selected').length
          if (seatCounterNumber.innerText >= 5) {
            seatCounterNumber.parentElement.classList.add('yellow')
          }
        }
      })
      seatElement.innerHTML = `${row + 1}-${seat + 1}`
      rowElement.appendChild(seatElement)
    }
    seatContainer.appendChild(rowElement)
  }
}

document.getElementById('show')?.addEventListener('change', async (event) => {
  document.getElementById('seatContainer').innerHTML =
    'Lade Sitzplatbelegung...'
  const data = await getShows()
  const show = data.shows.find((show) => show.id == event.target.value)
  const { seats } = await getSeats(show.id)
  displaySeats(show, seats)
})

async function getShows() {
  try {
    const response = await fetch(`${API_URL}/shows`)
    return await response.json()
  } catch (error) {
    console.error(error)
  }
}

async function getSeats(showId) {
  try {
    const response = await fetch(`${API_URL}/seats/${showId}`)
    return await response.json()
  } catch (error) {
    console.error(error)
  }
}

async function fillShowSelect() {
  const { shows } = await getShows()
  const select = document.getElementById('show')
  let seatPromises = []
  let totalSeats = 0
  let totalBookedSeats = 0

  shows.forEach((show) => {
    totalSeats += show.seats * show.rows
    const option = document.createElement('option')
    option.value = show.id
    seatPromises.push(
      fetch(`${API_URL}/seats/${show.id}`)
        .then((response) => response.json())
        .then((data) => {
          const freeSeats = show.seats * show.rows - data.seats.length
          totalBookedSeats += data.seats.length
          option.text = `${show.name} (${show.date} ${show.time}) [${freeSeats} freie Plätze]`
          if (freeSeats <= 0) {
            option.disabled = true
          }
          select.appendChild(option)
        })
    )
  })

  Promise.all(seatPromises).then(() => {
    // Update progress bar
    const progressBar = document.getElementById('totalSeatsProgress')
    const progressText = document.getElementById('totalSeatsText')
    const bookedPercentage = (totalBookedSeats / totalSeats) * 100
    const remainingPercentage = 100 - bookedPercentage

    progressBar.classList.remove('indeterminate')
    progressBar.style.width = `${bookedPercentage}%`

    // Create gradient color based on remaining percentage
    const hue = remainingPercentage * 1.2 // This will go from 0 (red) to 120 (green)
    progressBar.style.backgroundColor = `hsl(${hue}, 80%, 45%)`

    progressText.innerText = `${totalBookedSeats} Plätze gebucht. Noch ${
      totalSeats - totalBookedSeats
    } Plätze verfügbar (${Math.round(bookedPercentage)}% ausgebucht)`

    // If all options are disabled, show a message
    if (Array.from(select.options).every((option) => option.disabled)) {
      select.options[0].text = 'Alle Vorstellungen sind ausgebucht.'
      document.getElementById('allBooked').style.display = 'block'
    } else {
      select.options[0].text = 'Bitte wähle eine Vorstellung aus.'
      document.getElementById('allBooked').style.display = 'none'
    }
    select.options[0].selected = true

    // Sort options by date
    const sortedOptions = Array.from(select.options).sort((a, b) => {
      if (a.text < b.text) {
        return -1
      }
      if (a.text > b.text) {
        return 1
      }
      return 0
    })

    // Remove all options
    while (select.firstChild) {
      select.removeChild(select.firstChild)
    }

    // Add sorted options
    sortedOptions.forEach((option) => {
      select.appendChild(option)
    })
  })
}
