jest.mock('../../server/ingestion/alerter', () => ({
  sendIngestionAlert: jest.fn().mockResolvedValue(),
}));

const { runWithRetry } = require('../../server/ingestion/retryRunner');
const { sendIngestionAlert } = require('../../server/ingestion/alerter');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('runWithRetry()', () => {
  test('calls function once on success', async () => {
    const fn = jest.fn().mockResolvedValue();
    await runWithRetry('test-source', fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sendIngestionAlert).not.toHaveBeenCalled();
  });

  test('retries on failure and succeeds on second attempt', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce();

    await runWithRetry('test-source', fn);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sendIngestionAlert).not.toHaveBeenCalled();
  });

  test('retries on failure and succeeds on third attempt', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValueOnce();

    await runWithRetry('test-source', fn);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sendIngestionAlert).not.toHaveBeenCalled();
  });

  test('sends alert after all 3 retries exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Persistent failure'));

    await runWithRetry('test-source', fn);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sendIngestionAlert).toHaveBeenCalledTimes(1);
    expect(sendIngestionAlert).toHaveBeenCalledWith('test-source', 'Persistent failure', 3);
  });

  test('passes correct source name to alert', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('API down'));

    await runWithRetry('eurostat', fn);
    expect(sendIngestionAlert).toHaveBeenCalledWith('eurostat', 'API down', 3);
  });

  test('passes last error message when errors differ across attempts', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockRejectedValueOnce(new Error('Connection reset'))
      .mockRejectedValueOnce(new Error('DNS failure'));

    await runWithRetry('iom', fn);
    expect(sendIngestionAlert).toHaveBeenCalledWith('iom', 'DNS failure', 3);
  });
});
