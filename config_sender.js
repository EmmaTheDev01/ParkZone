const { MailtrapClient } = require("mailtrap");
require("dotenv").config();

const TOKEN = process.env.MAILTRAP_TOKEN;

if (!TOKEN) {
  console.error("Missing MAILTRAP_TOKEN. Add it to .env or set it in your environment.");
  process.exitCode = 1;
  return;
}

const client = new MailtrapClient({
  token: TOKEN,
});

const sender = {
  email: "hello@demomailtrap.co",
  name: "Mailtrap Test",
};
const recipients = [
  {
    email: "alkaisykais45@gmail.com",
  }
];

client.send({
    from: sender,
    to: recipients,
    subject: "You are awesome!",
    text: "Congrats for sending test email with Mailtrap!",
    category: "Integration Test",
  })
  .then((response) => {
    console.log("Test email sent successfully:", response.message_ids);
  })
  .catch((error) => {
    console.error("Failed to send test email:", error.message);
    process.exitCode = 1;
  });