const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+918374778183';
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

const normalizeMobile = value => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits;
};

const getReceiptImageUrl = (req, receiptNumber) => {
  const configuredBaseUrl = process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL;
  if (!configuredBaseUrl) return '';
  return `${configuredBaseUrl.replace(/\/$/, '')}/api/receipts/${encodeURIComponent(receiptNumber)}/image.svg`;
};

async function sendWhatsAppReceipt(donor, req) {
  if (!client) return false;

  const mobile = normalizeMobile(donor.mobile);
  if (!mobile) return false;

  const messageText = `🙏 Thank you for donating to ${process.env.COMMITTEE_NAME || 'SD Colony Ganesh Utsav Committee'} 2026 🌺

Your support helps us celebrate with devotion and unity.
May Lord Ganesha bless you and your family with happiness, health, and prosperity. 🕉️✨

Receipt No: ${donor.receiptNumber}
Donor: ${donor.donorName}
Plot: ${donor.flatNumber || '--'}
Amount: ₹${donor.amount}
Payment Mode: ${donor.paymentMode || 'Cash'}

${donor.isUpdate ? '📝 Your donor details have been updated successfully.' : '🎉 Your donation has been recorded successfully.'}

Thanks & Regards,
Together we celebrate. Together we grow.
${process.env.COMMITTEE_NAME || 'SD Colony Ganesh Utsav Committee'} 🌺`;

  const imageUrl = getReceiptImageUrl(req, donor.receiptNumber);
  const message = {
    from,
    to: `whatsapp:+${mobile}`,
    body: messageText,
  };
  if (imageUrl) message.mediaUrl = [imageUrl];

  await client.messages.create(message);
  console.log(`WhatsApp receipt sent to ${donor.donorName}`);
  return true;
}

module.exports = { sendWhatsAppReceipt };