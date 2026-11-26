'use strict';

/**
 * Mailgun email adapter for Parse Server.
 *
 * Drop-in replacement for parse-server-mailgun-adapter-template@1.1.7 (same module
 * name, same options, same templates), without the abandoned mailgun-js client and
 * its vulnerable dependency tree: messages are sent with the Node.js native fetch
 * to the Mailgun HTTP API.
 *
 * Options:
 * - apiKey, domain, fromAddress (required)
 * - host: Mailgun API host, "api.eu.mailgun.net" for the EU region (default "api.mailgun.net")
 * - verificationSubject, verificationBody, verificationBodyHTML
 * - passwordResetSubject, passwordResetBody, passwordResetBodyHTML
 *
 * Templates accept the placeholders %username%, %email%, %appname% and %link%.
 */

const DEFAULT_HOST = 'api.mailgun.net';
const REQUEST_TIMEOUT_MS = 30000;

const DEFAULT_TEMPLATES = {
  verificationSubject: 'Please verify your e-mail for %appname%',
  verificationBody:
    'Hi,\n\nYou are being asked to confirm the e-mail address %email% ' +
    'with %appname%\n\nClick here to confirm it:\n%link%',
  passwordResetSubject: 'Password Reset Request for %appname%',
  passwordResetBody:
    'Hi,\n\nYou requested a password reset for %appname%.\n\nClick here ' + 'to reset it:\n%link%',
};

function fillVariables(text, options) {
  const values = {
    username: options.user.get('username'),
    email: options.user.get('email'),
    appname: options.appName,
    link: options.link,
  };
  // A replacer function keeps "$" sequences of the values literal
  return text.replace(/%(username|email|appname|link)%/g, (match, name) =>
    values[name] === undefined || values[name] === null ? '' : String(values[name])
  );
}

function getRecipient(user) {
  return user.get('email') || user.get('username');
}

function formatAddress(name, address) {
  if (!name) {
    return address;
  }
  return `"${String(name).replace(/["\\\r\n]/g, '')}" <${address}>`;
}

const SimpleMailgunAdapter = mailgunOptions => {
  if (
    !mailgunOptions ||
    !mailgunOptions.apiKey ||
    !mailgunOptions.domain ||
    !mailgunOptions.fromAddress
  ) {
    throw 'SimpleMailgunAdapter requires an API Key, domain, and fromAddress.';
  }

  const options = { ...mailgunOptions };
  for (const key of Object.keys(DEFAULT_TEMPLATES)) {
    options[key] = options[key] || DEFAULT_TEMPLATES[key];
  }

  const host = options.host || DEFAULT_HOST;
  const url = `https://${host}/v3/${encodeURIComponent(options.domain)}/messages`;
  const authorization = 'Basic ' + Buffer.from(`api:${options.apiKey}`).toString('base64');

  async function send(message) {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(message)) {
      if (value !== undefined && value !== null && value !== '') {
        body.append(key, value);
      }
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: authorization },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
    if (!response.ok) {
      const error = new Error(
        `Mailgun API error ${response.status}: ${payload.message || response.statusText}`
      );
      error.statusCode = response.status;
      throw error;
    }
    return payload;
  }

  function sendTemplate(templateOptions, subjectKey, bodyKey, htmlKey) {
    const html = options[htmlKey];
    return send({
      // With an HTML template the sender is shown with the app name, as in 1.1.7
      from: html
        ? formatAddress(templateOptions.appName, options.fromAddress)
        : options.fromAddress,
      to: getRecipient(templateOptions.user),
      subject: fillVariables(options[subjectKey], templateOptions),
      text: fillVariables(options[bodyKey], templateOptions),
      html: html ? fillVariables(html, templateOptions) : undefined,
    });
  }

  const sendVerificationEmail = templateOptions =>
    sendTemplate(
      templateOptions,
      'verificationSubject',
      'verificationBody',
      'verificationBodyHTML'
    );

  const sendPasswordResetEmail = templateOptions =>
    sendTemplate(
      templateOptions,
      'passwordResetSubject',
      'passwordResetBody',
      'passwordResetBodyHTML'
    );

  const sendMail = mail =>
    send({
      from: options.fromAddress,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

  return Object.freeze({
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendMail,
  });
};

module.exports = SimpleMailgunAdapter;
