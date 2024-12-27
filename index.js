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
        table.string('created')
        table.timestamps(true, true)
      })
    }
  })
  .catch((error) => {
    console.error(error)
  })

knex.schema
  .hasTable('shows')
  .then((exists) => {
    if (!exists) {
      return knex.schema.createTable('shows', (table) => {
        table.increments('id').primary()
        table.string('name')
        table.string('date')
        table.string('time')
        table.string('rows')
        table.string('seats')
        table.timestamps(true, true)
      })
    }
  })
  .catch((error) => {
    console.error(error)
  })

knex.schema
  .hasTable('seats')
  .then((exists) => {
    if (!exists) {
      return knex.schema.createTable('seats', (table) => {
        table.increments('id').primary()
        table.string('row')
        table.string('seat')
        table.string('ticketId')
        table.string('show')
        table.timestamps(true, true)
      })
    }
  })
  .catch((error) => {
    console.error(error)
  })

// Populate shows if empty
knex('shows')
  .select()
  .then((shows) => {
    if (shows.length === 0) {
      return knex('shows').insert(config.shows)
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

function mailTemplate(string, data) {
  for (const key in data) {
    string = string.replace(`{${key}}`, data[key])
  }
  return string
}

// Loggin middleware for api
app.use('/api', (request, response, next) => {
  console.log(request.method, request.url)
  next()
})

// Get all tickets (admin endpoint)
app.get('/api/tickets', async (request, response) => {
  try {
    // Check if the password is correct
    const password = request.headers['x-password']
    if (password !== config.adminPassword) {
      return response.status(401).json({ error: 'Unauthorized' })
    }
    const tickets = await knex.select().table('tickets')
    const seats = await knex.select().table('seats')
    return response.json({
      message: 'Tickets gefunden',
      tickets,
      seats,
    })
  } catch (error) {
    console.error(error)
    return response.status(500).json({ error: 'Internal server error' })
  }
})

// Get all shows with seats
app.get('/api/shows', async (request, response) => {
  try {
    const shows = await knex.select().table('shows')
    return response.json({
      message: 'Shows gefunden',
      shows,
    })
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/seats/:showId', async (request, response) => {
  try {
    const { showId } = request.params
    const seats = await knex('seats').where({ show: showId })
    response.json({
      message: 'Sitzpläte gefunden',
      seats,
    })
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Create a new ticket
app.post('/api/tickets', async (request, response) => {
  try {
    const {
      name,
      email,
      show,
      seats,
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
    if (!seats) {
      return response.status(400).json({ error: 'Sitzpläte fehlen' })
    }
    let parsedSeats
    try {
      parsedSeats = JSON.parse(seats)
    } catch (error) {
      return response.status(400).json({ error: 'Sitzpläte ungültig' })
    }

    // parsedSeats should be 1 - 5
    if (parsedSeats.length < 1 || parsedSeats.length > 5) {
      return response
        .status(400)
        .json({ error: 'Anzahl Sitzpläte muss zwischen 1 und 5 liegen' })
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

    // Check if the seats are already booked
    const bookedSeats = await knex('seats').where({ show })
    for (const parsedSeat of parsedSeats) {
      let [row, seat] = parsedSeat.split('-')
      row--
      seat--
      const seatExists = bookedSeats.some(
        (bookedSeat) => bookedSeat.row == row && bookedSeat.seat == seat
      )
      if (seatExists) {
        return response.status(400).json({ error: 'Sitzplatz bereits belegt' })
      }
    }

    // Create ticket
    const created = new Date().toISOString()
    // Generate a random ticket ID
    const ticketId = Math.random().toString(36).substr(2, 9)
    const ticket = { name, email, show, created, ticketId }
    const [id] = await knex('tickets').insert(ticket)

    // Create seats
    for (const parsedSeat of parsedSeats) {
      let [row, seat] = parsedSeat.split('-')
      row--
      seat--
      await knex('seats').insert({ row, seat, ticketId, show })
    }

    await transporter.sendMail({
      from: `"Kolpingjugend Ramsen" <${config.emailUser}>`, // sender address
      to: ticket.email,
      subject: config.emails.reservation.subject,
      text: mailTemplate(config.emails.reservation.body, {
        NAME: ticket.name,
        DATE: shows[0].date,
        TIME: shows[0].time,
        INFO_LINK: `${config.url}/info.html#${ticket.ticketId}`,
        SEATS: parsedSeats.join(', '),
      }),
    })

    console.log('Ticket created', ticketId)

    // Notify via discord webhook
    await $fetch(config.discordWebhook, {
      body: {
        content: `Ein Ticket wurde erstellt. Show: ${
          shows[0].name
        }, Sitzplätze: ${parsedSeats.join(', ')}`,
      },
      method: 'POST',
    })

    return response.json({ message: 'Ticket erstellt', ticketId })
  } catch (error) {
    console.error(error)
    return response.status(500).json({ error: 'Internal server error' })
  }
})

// Delete a ticket
app.delete('/api/tickets/:ticketId', async (request, response) => {
  try {
    const { ticketId } = request.params
    // Check if the ticket exists
    const ticket = await knex('tickets').where({ ticketId }).first()
    if (!ticket) {
      return response.status(400).json({ error: 'Ticket existiert nicht' })
    }
    const show = await knex('shows').where({ id: ticket.show }).first()
    if (!show) {
      return response.status(400).json({ error: 'Show existiert nicht' })
    }

    await knex('tickets').where({ ticketId }).del()

    // Free the seats
    await knex('seats').where({ ticketId }).del()

    await transporter.sendMail({
      from: `"Kolpingjungen Ramsen" <${config.emailUser}>`,
      to: ticket.email,
      subject: config.emails.cancellation.subject,
      text: mailTemplate(config.emails.cancellation.body, {
        NAME: ticket.name,
        DATE: show.date,
        TIME: show.time,
        INFO_LINK: config.url,
      }),
    })

    console.log('Ticket deleted', ticketId)

    // Notify via discord webhook
    await $fetch(config.discordWebhook, {
      body: {
        content: `Ein Ticket wurde storniert. Show: ${show.name}`,
      },
      method: 'POST',
    })

    return response.json({ ticketId, message: 'Ticket gelöscht' })
  } catch (error) {
    console.error(error)
    response
      .status(500)
      .json({ error: 'Internal server error', message: error })
  }
})

// Get a single ticket
app.get('/api/tickets/:ticketId', async (request, response) => {
  try {
    const { ticketId } = request.params
    const ticket = await knex('tickets').where({ ticketId }).first()
    if (!ticket) {
      return response.status(400).json({ error: 'Ticket existiert nicht' })
    }
    const seats = await knex('seats').where({ ticketId })
    const show = await knex('shows').where({ id: ticket.show }).first()
    return response.json({
      message: 'Ticket gefunden',
      ticket,
      seats,
      show,
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
