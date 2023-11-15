const express = require('express')
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './data.sqlite',
  },
})

const config = require('./config.json')

// Create db if not exists
knex.schema
  .hasTable('tickets')
  .then((exists) => {
    if (!exists) {
      return knex.schema.createTable('tickets', (table) => {
        table.increments('id').primary()
        table.string('ticketId')
        table.string('name')
        table.string('email')
        table.string('show')
        table.string('numPeople')
        table.string('created')
        table.timestamps(true, true)
      })
    }
  })
  .catch((error) => {
    console.error(error)
  })

knex.schema.hasTable('shows').then((exists) => {
  if (!exists) {
    return knex.schema.createTable('shows', (table) => {
      table.increments('id').primary()
      table.string('name')
      table.string('date')
      table.string('time')
      table.string('totalSeats')
      table.string('freeSeats')
      table.timestamps(true, true)
    })
  }
})

// Populate shows if empty
knex('shows')
  .select()
  .then((shows) => {
    if (shows.length === 0) {
      const shows = [
        {
          name: 'Aufführung 1',
          date: '2023-12-29',
          time: '18:00',
          totalSeats: 50,
          freeSeats: 50,
        },
        {
          name: 'Aufführung 2',
          date: '2023-12-29',
          time: '20:00',
          totalSeats: 50,
          freeSeats: 50,
        },
      ]
      return knex('shows').insert(shows)
    }
  })
  .catch((error) => {
    console.error(error)
  })

const app = express()
const port = 3000

app.use(express.json())
app.use(express.static('fronted'))

// Get all tickets
app.get('/ticket', async (request, response) => {
  try {
    // Check if the password is correct
    const password = request.headers.get('X-Password')
    if (password !== config.adminPassword) {
      return response.status(401).json({ error: 'Unauthorized' })
    }
    const tickets = await knex.select().table('tickets')
    response.json(tickets)
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Get all shows
app.get('/show', async (request, response) => {
  try {
    const shows = await knex.select().table('shows')
    response.json(shows)
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Create a new ticket
app.post('/ticket', async (request, response) => {
  try {
    const { name, email, show, numPeople } = request.body

    // Validate all fields
    if (!name) {
      return response.status(400).json({ error: 'Name fehlt' })
    }
    if (!email) {
      return response.status(400).json({ error: 'Email fehlt' })
    }
    if (!show) {
      return response.status(400).json({ error: 'Show fehlt' })
    }
    if (!numPeople) {
      return response.status(400).json({ error: 'Anzahl Personen fehlt' })
    }
    // numPeople should be 1 - 5
    if (numPeople < 1 || numPeople > 5) {
      return response
        .status(400)
        .json({ error: 'Anzahl Personen muss zwischen 1 und 5 liegen' })
    }

    const token = body.get('cf-turnstile-response')
    const ip = request.headers.get('CF-Connecting-IP')

    // Validate the token by calling the
    // "/siteverify" API endpoint.
    let formData = new FormData()
    formData.append('secret', config['cf-secret'])
    formData.append('response', token)
    formData.append('remoteip', ip)

    const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
    const result = await fetch(url, {
      body: formData,
      method: 'POST',
    })

    const outcome = await result.json()
    if (!outcome.success) {
      return response.status(400).json({ error: 'Captcha invalid' })
    }

    // Check if show exists
    const shows = await knex('shows').where({ id: show })
    if (shows.length === 0) {
      return response.status(400).json({ error: 'Show existiert nicht' })
    }

    // Check if there are enough free seats
    const freeSeats = shows[0].freeSeats
    if (freeSeats < numPeople) {
      return response.status(400).json({ error: 'Nicht genügend freie Plätze' })
    }

    // Check if email is already used
    const tickets = await knex('tickets').where({ email })
    if (tickets.length > 0) {
      return response.status(400).json({ error: 'Email bereits verwendet' })
    }

    // Create ticket
    const created = new Date().toISOString()
    // Generate a random ticket ID
    const ticketId = Math.random().toString(36).substr(2, 9)
    const ticket = { name, email, show, numPeople, created, ticketId }
    const [id] = await knex('tickets').insert(ticket)

    // Update free seats
    await knex('shows')
      .where({ id: show })
      .update({ freeSeats: freeSeats - numPeople })

    return response.json({ message: 'Ticket erstellt', ticketId })
  } catch (error) {
    console.error(error)
    return response.status(500).json({ error: 'Internal server error' })
  }
})

// Delete a ticket
app.delete('/ticket/:ticketId', async (request, response) => {
  try {
    const { ticketId } = request.params
    // Check if the ticket exists
    const tickets = await knex('tickets').where({ ticketId: id })
    if (tickets.length === 0) {
      return response.status(400).json({ error: 'Ticket existiert nicht' })
    }
    await knex('tickets').where({ id }).del()
    response.json({ id, message: 'Ticket gelöscht' })
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Get a single ticket
app.get('/ticket/:ticketId', async (request, response) => {
  try {
    const { ticketId } = request.params
    const ticket = await knex('tickets').where({ id }).first()
    response.json(ticket)
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Run server
app.listen(port, () => {
  console.log(`Server listening at http://0.0.0.0:${port}`)
})
