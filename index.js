const express = require('express')
const { $fetch } = require('ohmyfetch')
const nodemailer = require('nodemailer')
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './data.sqlite',
  },
  useNullAsDefault: true,
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

const mailConfig = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: config.emailUser,
    pass: config.emailPassword,
  },
}

const transporter = nodemailer.createTransport(mailConfig)

const app = express()
const port = config.port || 3000

app.use(express.json())
app.use(express.static('frontend'))

// Loggin middleware for api
app.use('/api', (request, response, next) => {
  console.log(request.method, request.url)
  next()
})

// Get all tickets
app.get('/api/ticket', async (request, response) => {
  try {
    // Check if the password is correct
    const password = request.headers['x-password']
    if (password !== config.adminPassword) {
      return response.status(401).json({ error: 'Unauthorized' })
    }
    const tickets = await knex.select().table('tickets')
    response.json({
      message: 'Tickets gefunden',
      tickets,
    })
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Get all shows
app.get('/api/show', async (request, response) => {
  try {
    const shows = await knex.select().table('shows')
    response.json(shows)
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Create a new ticket
app.post('/api/ticket', async (request, response) => {
  try {
    const {
      name,
      email,
      show,
      numPeople,
      ['cf-turnstile-response']: token,
    } = request.body

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

    const ip = request.headers['cf-connecting-ip'] || request.ip

    // Validate the token by calling the Cloudflare API
    const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
    const result = await $fetch(url, {
      body: {
        secret: config['cf-secret'],
        response: token,
        remoteip: ip,
      },
      method: 'POST',
      parseResponse: JSON.parse,
    })

    if (!result.success) {
      return response.status(400).json({ error: 'Captcha invalid', result })
    }

    // Check if show exists
    const shows = await knex('shows').where({ id: show })
    if (shows.length === 0) {
      return response.status(400).json({ error: 'Show existiert nicht' })
    }

    // Check if email is already used
    const tickets = await knex('tickets').where({ email })
    if (tickets.length > 0) {
      return response.status(400).json({ error: 'Email bereits verwendet' })
    }

    // Check if there are enough free seats
    const freeSeats = shows[0].freeSeats
    if (freeSeats < numPeople) {
      return response.status(400).json({ error: 'Nicht genügend freie Plätze' })
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
      .update({ freeSeats: parseInt(freeSeats) - parseInt(numPeople) })

    await transporter.sendMail({
      from: `"Kolpingjungen Ramsen" <${config.emailUser}>`, // sender address
      to: ticket.email,
      subject: 'Ticket Buchung - Kolpingjungen Ramsen',
      text: `Hallo ${ticket.name}, dein Ticket wurde erfolgreich gebucht. Du kannst es unter folgendem Link aufrufen: https://theater.logge.top/info.html#${ticket.ticketId}. Falls du Fragen hast, kannst du dich gerne an uns wenden. Viele Grüße, Kolpingjungen Ramsen`,
    })

    return response.json({ message: 'Ticket erstellt', ticketId })
  } catch (error) {
    console.error(error)
    return response.status(500).json({ error: 'Internal server error' })
  }
})

// Delete a ticket
app.delete('/api/ticket/:ticketId', async (request, response) => {
  try {
    const { ticketId } = request.params
    // Check if the ticket exists
    const tickets = await knex('tickets').where({ ticketId })
    if (tickets.length === 0) {
      return response.status(400).json({ error: 'Ticket existiert nicht' })
    }
    await knex('tickets').where({ ticketId }).del()
    // Update free seats
    const ticket = tickets[0]
    const shows = await knex('shows').where({ id: ticket.show })
    const show = shows[0]
    await knex('shows')
      .where({ id: ticket.show })
      .update({
        freeSeats: parseInt(show.freeSeats) + parseInt(ticket.numPeople),
      })

    await transporter.sendMail({
      from: `"Kolpingjungen Ramsen" <${config.emailUser}>`, // sender address
      to: ticket.email,
      subject: 'Ticket Stornierung - Kolpingjungen Ramsen',
      text: `Hallo ${ticket.name}, dein Ticket wurde storniert. Falls du Fragen hast, kannst du dich gerne an uns wenden. Viele Grüße, Kolpingjungen Ramsen`,
    })

    response.json({ ticketId, message: 'Ticket gelöscht' })
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Get a single ticket
app.get('/api/ticket/:ticketId', async (request, response) => {
  try {
    const { ticketId } = request.params
    const ticket = await knex('tickets').where({ ticketId }).first()
    if (!ticket) {
      return response.status(400).json({ error: 'Ticket existiert nicht' })
    }
    response.json({
      message: 'Ticket gefunden',
      ticket,
    })
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Run server
app.listen(port, () => {
  console.log(`Server listening at http://127.0.0.1:${port}`)
})
