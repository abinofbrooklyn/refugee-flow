const { sumToQuarters, fetchMonthlyData, EU_GEO, CITIZEN_CODES } = require('../../server/ingestion/eurostatIngestion');

// Mock database
jest.mock('../../server/database/connection', () => {
  const mockKnex = jest.fn(() => mockKnex);
  mockKnex.insert = jest.fn(() => mockKnex);
  mockKnex.onConflict = jest.fn(() => mockKnex);
  mockKnex.merge = jest.fn(() => Promise.resolve());
  mockKnex.select = jest.fn(() => Promise.resolve([]));
  mockKnex.where = jest.fn(() => mockKnex);
  mockKnex.orderBy = jest.fn(() => Promise.resolve([]));
  mockKnex.first = jest.fn(() => Promise.resolve(null));
  return mockKnex;
});

jest.mock('../../server/ingestion/ingestionLogger', () => ({
  logIngestion: jest.fn(() => Promise.resolve()),
  getLastSyncDate: jest.fn(() => Promise.resolve(null)),
}));

describe('eurostatIngestion', () => {
  describe('sumToQuarters', () => {
    it('sums Jan-Mar into q1', () => {
      const monthly = [
        { month: '2023-01', value: 100 },
        { month: '2023-02', value: 200 },
        { month: '2023-03', value: 150 },
      ];
      const rows = sumToQuarters(monthly, 'Afghanistan', 'Austria');
      expect(rows).toEqual([
        { record_id: null, year: '2023', quarter: 'q1', origin: 'Afghanistan', destination: 'Austria', value: 450 },
      ]);
    });

    it('sums Apr-Jun into q2', () => {
      const monthly = [
        { month: '2023-04', value: 50 },
        { month: '2023-05', value: 75 },
        { month: '2023-06', value: 100 },
      ];
      const rows = sumToQuarters(monthly, 'Syria', 'Germany');
      expect(rows).toEqual([
        { record_id: null, year: '2023', quarter: 'q2', origin: 'Syria', destination: 'Germany', value: 225 },
      ]);
    });

    it('splits full year into 4 quarters', () => {
      const monthly = [
        { month: '2023-01', value: 10 }, { month: '2023-02', value: 20 }, { month: '2023-03', value: 30 },
        { month: '2023-04', value: 40 }, { month: '2023-05', value: 50 }, { month: '2023-06', value: 60 },
        { month: '2023-07', value: 70 }, { month: '2023-08', value: 80 }, { month: '2023-09', value: 90 },
        { month: '2023-10', value: 100 }, { month: '2023-11', value: 110 }, { month: '2023-12', value: 120 },
      ];
      const rows = sumToQuarters(monthly, 'Iraq', 'Sweden');
      expect(rows).toHaveLength(4);
      expect(rows.find(r => r.quarter === 'q1').value).toBe(60);
      expect(rows.find(r => r.quarter === 'q2').value).toBe(150);
      expect(rows.find(r => r.quarter === 'q3').value).toBe(240);
      expect(rows.find(r => r.quarter === 'q4').value).toBe(330);
    });

    it('handles data spanning multiple years', () => {
      const monthly = [
        { month: '2022-11', value: 100 },
        { month: '2022-12', value: 200 },
        { month: '2023-01', value: 300 },
      ];
      const rows = sumToQuarters(monthly, 'Somalia', 'Italy');
      expect(rows).toHaveLength(2);
      expect(rows.find(r => r.year === '2022' && r.quarter === 'q4').value).toBe(300);
      expect(rows.find(r => r.year === '2023' && r.quarter === 'q1').value).toBe(300);
    });

    it('returns empty array for no data', () => {
      expect(sumToQuarters([], 'Test', 'Test')).toEqual([]);
    });
  });

  describe('EU_GEO mapping', () => {
    it('contains at least 27 EU + 3 EEA countries', () => {
      expect(Object.keys(EU_GEO).length).toBeGreaterThanOrEqual(30);
    });

    it('maps AT to Austria', () => {
      expect(EU_GEO.AT).toBe('Austria');
    });

    it('maps DE to Germany', () => {
      expect(EU_GEO.DE).toBe('Germany');
    });
  });

  describe('CITIZEN_CODES mapping', () => {
    it('maps AF to Afghanistan', () => {
      expect(CITIZEN_CODES.AF).toBe('Afghanistan');
    });

    it('maps SY to Syria', () => {
      expect(CITIZEN_CODES.SY).toBe('Syria');
    });
  });

  describe('fetchMonthlyData', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      delete global.fetch;
    });

    it('returns empty array on 404 (no data for pair)', async () => {
      global.fetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
      const result = await fetchMonthlyData('AF', 'AT', '2023-01', '2023-06');
      expect(result).toEqual([]);
    });

    it('throws on non-404 error', async () => {
      global.fetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
      await expect(fetchMonthlyData('AF', 'AT', '2023-01', '2023-06')).rejects.toThrow('Eurostat API error: 500');
    });

    it('parses SDMX XML with monthly observations', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <m:GenericData xmlns:m="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message"
                       xmlns:g="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/generic">
          <m:DataSet>
            <g:Series>
              <g:Obs><g:ObsDimension value="2023-01"/><g:ObsValue value="650"/></g:Obs>
              <g:Obs><g:ObsDimension value="2023-02"/><g:ObsValue value="495"/></g:Obs>
              <g:Obs><g:ObsDimension value="2023-03"/><g:ObsValue value="500"/></g:Obs>
            </g:Series>
          </m:DataSet>
        </m:GenericData>`;

      global.fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve(xml) });
      const result = await fetchMonthlyData('AF', 'AT', '2023-01', '2023-03');

      expect(result).toEqual([
        { month: '2023-01', value: 650 },
        { month: '2023-02', value: 495 },
        { month: '2023-03', value: 500 },
      ]);
    });
  });
});
