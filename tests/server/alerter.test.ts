jest.mock('resend', () => {
  const sendMock = jest.fn().mockResolvedValue({ id: 'email_123' });
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: { send: sendMock },
    })),
    _sendMock: sendMock,
  };
});

import { sendIngestionAlert, sendQuarantineAlert } from '../../server/ingestion/alerter';
const { Resend, _sendMock: sendMock } = require('resend') as { Resend: jest.Mock; _sendMock: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ALERT_EMAIL = 'test@example.com';
  process.env.FROM_EMAIL = 'from@example.com';
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
    expect(callArgs.to).toBe('test@example.com');
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

describe('sendQuarantineAlert()', () => {
  const sampleItems = [
    {
      row: { id: 123, route: 'Central Mediterranean', lat: 5, lng: 40 },
      violations: [{ rule: 'geo-label-mismatch', expected: 'Horn of Africa', found: 'Central Mediterranean', detail: 'coords fall in Horn of Africa' }],
    },
  ];

  test('does nothing when quarantinedItems array is empty', async () => {
    process.env.RESEND_API_KEY = 'test_key_123';
    await sendQuarantineAlert('iom', []);
    expect(sendMock).not.toHaveBeenCalled();
    delete process.env.RESEND_API_KEY;
  });

  test('does not send email when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY;
    await sendQuarantineAlert('iom', sampleItems);
    expect(Resend).not.toHaveBeenCalled();
  });

  test('sends email with quarantine details when API key is set', async () => {
    process.env.RESEND_API_KEY = 'test_key_123';
    await sendQuarantineAlert('iom', sampleItems);
    expect(Resend).toHaveBeenCalledWith('test_key_123');
    expect(sendMock).toHaveBeenCalledTimes(1);
    const callArgs = sendMock.mock.calls[0][0];
    expect(callArgs.to).toBe('test@example.com');
    expect(callArgs.subject).toContain('Data Quality');
    expect(callArgs.subject).toContain('1 rows quarantined');
    expect(callArgs.html).toContain('geo-label-mismatch');
    expect(callArgs.html).toContain('Expected:');
    expect(callArgs.html).toContain('Found:');
    expect(callArgs.html).toContain('Central Mediterranean');
    delete process.env.RESEND_API_KEY;
  });

  test('does not throw when Resend API fails', async () => {
    process.env.RESEND_API_KEY = 'test_key_123';
    sendMock.mockRejectedValueOnce(new Error('Resend API error'));
    await expect(sendQuarantineAlert('iom', sampleItems)).resolves.not.toThrow();
    delete process.env.RESEND_API_KEY;
  });
});
