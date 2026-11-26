'use strict';

const { loadAdapter } = require('../lib/Adapters/AdapterLoader');
const MailgunAdapter = require('parse-server-mailgun-adapter-template');

const baseOptions = {
  apiKey: 'key-test',
  domain: 'mg.example.com',
  fromAddress: 'no-reply@example.com',
};

function fakeUser(attributes) {
  return { get: key => attributes[key] };
}

function mockFetch(
  status = 200,
  body = '{"id":"<1@mg.example.com>","message":"Queued. Thank you."}'
) {
  return spyOn(global, 'fetch').and.callFake(async () => new Response(body, { status }));
}

function sentFields(fetchSpy, call = 0) {
  return Object.fromEntries(fetchSpy.calls.argsFor(call)[1].body.entries());
}

describe('Mailgun email adapter', () => {
  it('requires apiKey, domain and fromAddress', () => {
    expect(() => MailgunAdapter()).toThrow();
    expect(() => MailgunAdapter({ apiKey: 'k', domain: 'd' })).toThrow();
    expect(() => MailgunAdapter(baseOptions)).not.toThrow();
  });

  it('loads through the module name used in the Parse Server configuration', () => {
    const adapter = loadAdapter({
      module: 'parse-server-mailgun-adapter-template',
      options: baseOptions,
    });
    expect(typeof adapter.sendVerificationEmail).toBe('function');
    expect(typeof adapter.sendPasswordResetEmail).toBe('function');
    expect(typeof adapter.sendMail).toBe('function');
  });

  it('sends a text verification email with the default template', async () => {
    const fetchSpy = mockFetch();
    const adapter = MailgunAdapter(baseOptions);
    const result = await adapter.sendVerificationEmail({
      appName: 'MyApp',
      link: 'https://example.com/verify?token=$1',
      user: fakeUser({ username: 'john', email: 'john@example.com' }),
    });

    expect(result.message).toBe('Queued. Thank you.');
    const [url, init] = fetchSpy.calls.argsFor(0);
    expect(url).toBe('https://api.mailgun.net/v3/mg.example.com/messages');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(
      'Basic ' + Buffer.from('api:key-test').toString('base64')
    );
    const fields = sentFields(fetchSpy);
    expect(fields.from).toBe('no-reply@example.com');
    expect(fields.to).toBe('john@example.com');
    expect(fields.subject).toBe('Please verify your e-mail for MyApp');
    expect(fields.text).toContain('confirm the e-mail address john@example.com with MyApp');
    expect(fields.text).toContain('https://example.com/verify?token=$1');
    expect(fields.html).toBeUndefined();
  });

  it('sends an HTML password reset email with the app name as sender name', async () => {
    const fetchSpy = mockFetch();
    const adapter = MailgunAdapter({
      ...baseOptions,
      host: 'api.eu.mailgun.net',
      passwordResetSubject: 'Reset for %username%',
      passwordResetBody: 'Text %link%',
      passwordResetBodyHTML: '<a href="%link%">%appname%</a> %email%',
    });
    await adapter.sendPasswordResetEmail({
      appName: 'My "App"',
      link: 'https://example.com/reset',
      user: fakeUser({ username: 'john' }),
    });

    expect(fetchSpy.calls.argsFor(0)[0]).toBe(
      'https://api.eu.mailgun.net/v3/mg.example.com/messages'
    );
    const fields = sentFields(fetchSpy);
    expect(fields.from).toBe('"My App" <no-reply@example.com>');
    // Falls back to the username when the user has no email
    expect(fields.to).toBe('john');
    expect(fields.subject).toBe('Reset for john');
    expect(fields.text).toBe('Text https://example.com/reset');
    expect(fields.html).toBe('<a href="https://example.com/reset">My "App"</a> ');
  });

  it('sends a custom email through sendMail', async () => {
    const fetchSpy = mockFetch();
    const adapter = MailgunAdapter(baseOptions);
    await adapter.sendMail({
      to: 'jane@example.com',
      subject: 'Hello',
      text: 'Plain',
      html: '<p>Rich</p>',
    });
    expect(sentFields(fetchSpy)).toEqual({
      from: 'no-reply@example.com',
      to: 'jane@example.com',
      subject: 'Hello',
      text: 'Plain',
      html: '<p>Rich</p>',
    });
  });

  it('rejects with the Mailgun error message and status', async () => {
    mockFetch(401, 'Forbidden');
    const adapter = MailgunAdapter(baseOptions);
    await expectAsync(
      adapter.sendMail({ to: 'jane@example.com', subject: 'Hello', text: 'Plain' })
    ).toBeRejectedWith(jasmine.objectContaining({ statusCode: 401 }));
  });
});
