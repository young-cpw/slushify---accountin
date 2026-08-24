const { loadAccounts, saveAccount } = require('../src/index');

describe('slushify accounting', () => {
  beforeEach(() => {
    // Clean up before each test
  });

  test('should save and load an account', () => {
    const account = { id: 'test-001', name: 'Test Account', balance: 1000 };
    saveAccount(account);
    const accounts = loadAccounts();
    expect(accounts).toContainEqual(expect.objectContaining(account));
  });
});