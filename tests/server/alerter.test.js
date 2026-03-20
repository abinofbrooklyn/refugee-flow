jest.mock('resend', () => {
  const sendMock = jest.fn().mockResolvedValue({ id: 'email_123' });
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: { send: sendMock },
    })),
    _sendMock: sendMock,
  };
});

const { sendIngestionAlert } = require('../../server/ingestion/alerter');
const { Resend, _sendMock: sendMock } = require('resend');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sendIngestionAlert()', () => {
  test('does not send email when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY;
    await sendIngestionAlert('acled', 'Auth failed', 3);
    expect(Resend).not.toHaveBeenCalled();
  });

  test('sends email when RESEND_API_KEY is set', async () => {
    process.env.RESEND_API_KEY = 'test_key_123';
    await sendIngestionAlert('acled', 'Auth failed', 3);
    expect(Resend).toHaveBeenCalledWith('test_key_123');
    expect(sendMock).toHaveBeenCalledTimes(1);
    delete process.env.RESEND_API_KEY;
  });

  test('email contains source name in subject', async () => {
    process.env.RESEND_API_KEY = 'test_key_123';
    await sendIngestionAlert('eurostat', 'API timeout', 3);
    const callArgs = sendMock.mock.calls[0][0];
    expect(callArgs.subject).toContain('Eurostat');
    expect(callArgs.to).toBe('abin.abraham4@gmail.com');
    delete process.env.RESEND_API_KEY;
  });

  test('email body contains error message and attempt count', async () => {
    process.env.RESEND_API_KEY = 'test_key_123';
    await sendIngestionAlert('iom', 'CSV download failed', 3);
    const callArgs = sendMock.mock.calls[0][0];
    expect(callArgs.html).toContain('CSV download failed');
    expect(callArgs.html).toContain('3');
    delete process.env.RESEND_API_KEY;
  });

  test('email contains probable causes for known source', async () => {
    process.env.RESEND_API_KEY = 'test_key_123';
    await sendIngestionAlert('cbp', 'Download failed', 3);
    const callArgs = sendMock.mock.calls[0][0];
    expect(callArgs.html).toContain('CBP changed CSV URL');
    delete process.env.RESEND_API_KEY;
  });

  test('handles unknown source gracefully', async () => {
    process.env.RESEND_API_KEY = 'test_key_123';
    await sendIngestionAlert('unknown-source', 'Something broke', 3);
    const callArgs = sendMock.mock.calls[0][0];
    expect(callArgs.subject).toContain('unknown-source');
    expect(callArgs.html).toContain('Something broke');
    delete process.env.RESEND_API_KEY;
  });

  test('does not throw when Resend API fails', async () => {
    process.env.RESEND_API_KEY = 'test_key_123';
    sendMock.mockRejectedValueOnce(new Error('Resend API error'));
    await expect(sendIngestionAlert('acled', 'fail', 3)).resolves.not.toThrow();
    delete process.env.RESEND_API_KEY;
  });
});
