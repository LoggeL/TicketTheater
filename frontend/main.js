const API_URL = 'api'

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

  //   Disable submit button
  const submitButton = document.getElementById('submit')
  submitButton.disabled = true

  //   Send form data to backend
  const formData = new FormData(event.target)
  const data = Object.fromEntries(formData.entries())
  console.log(data)
  fetch(`${API_URL}/ticket`, {
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
  fetch(`${API_URL}/ticket/${data.ticketId}`, {
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
  fetch(`${API_URL}/ticket/${ticketId}`, {
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
            displayTicketData(data.ticket)
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
  fetch(`${API_URL}/ticket`, {
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
            displayTickets(data.tickets)
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

async function getShows() {
  try {
    const response = await fetch(`${API_URL}/show`)
    const shows = await response.json()
    return shows
  } catch (error) {
    console.error(error)
  }
}

async function fillShowSelect() {
  const shows = await getShows()
  const select = document.getElementById('show')
  shows.forEach((show) => {
    const option = document.createElement('option')
    option.value = show.id
    // [${freeSeats} freie Plätze] ${name} (${date} ${time})
    option.text = `[${show.freeSeats} freie Plätze] ${show.name} (${show.date} ${show.time})`
    if (show.freeSeats <= 0) {
      option.disabled = true
    }
    select.appendChild(option)
  })
}

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

function captchaCallback() {
  const submitButton = document.getElementById('submit')
  submitButton.disabled = false
}
