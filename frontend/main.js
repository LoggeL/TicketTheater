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
  fetch('https://example.com', {
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

function displayError(e) {
  const snackbarError = document.getElementById('snackbarError')
  snackbarError.classList.add('active')
  snackbarError.innerHTML = e
  setTimeout(() => {
    snackbarError.classList.remove('active')
  }, 5000)
}

function displaySuccess(e) {
  const snackbarSuccess = document.getElementById('snackbarSuccess')
  snackbarSuccess.classList.add('active')
  snackbarSuccess.innerHTML = e
  setTimeout(() => {
    snackbarSuccess.classList.remove('active')
  }, 5000)
}

function captchaCallback() {
  const submitButton = document.getElementById('submit')
  submitButton.disabled = false
}
