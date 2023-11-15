# TicketTheater

TicketTheater

A simple ticketing system for a theater. The system will allow the user to book a seat for free for up to 5 people. The system will also allow the user to cancel a booking. The system will also allow the user to view the current bookings.

## API Endpoints

- GET `/api/ticket/<ticketId>`  
  Returns the ticket information for the given ticketId. If the `ticketId` is not found, a 404 error is returned. The fields returned are: `ticketId`, `name`, `email`, `show`, `numPeople`, `bookingDate`

- POST `/api/ticket`  
  Creates a new ticket. The request body should contain the following fields: `name`, `email`, `show`, `numPeople`, `cf-turnstile-response`. The `cf-turnstile-response` is the response from the Turnstile Captcha. It has to be validated by the server before the ticket is created. If the validation fails, a 400 error is returned. If the validation succeeds, a new ticket is created and the ticketId is returned. The `bookingDate` is set to the current date and time. Human readable error messages are returned in the response body as `message` or `error`.
  This endpoint triggers an email to be sent to the user with the ticket information.

- DELETE `/api/ticket/<ticketId>`  
  Deletes the ticket with the given `ticketId`. If the `ticketId` is not found, a 404 error is returned. If the ticket is successfully deleted, a 204 response is returned.  
  This endpoint triggers an email to be sent to the user with the canceling information.
