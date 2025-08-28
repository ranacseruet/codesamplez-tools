/**
 * @jest-environment jsdom
 */

// Create mock
const mockBuilder = {
  parseDateTime: jest.fn(value => {
    const date = new Date(value);
    return Math.floor(date.getTime() / 1000);
  }),
  buildJWT: jest.fn().mockResolvedValue('mocked.jwt.token'),
  getFormattedDate: jest.fn().mockReturnValue('2024-01-01T00:00:00Z'),
  generateRandomSecret: jest.fn().mockReturnValue('random-secret-key-32-chars-long!!')
};

// Mock modules
jest.mock('./JWTBuilder.js', () => ({
  JWTBuilder: jest.fn(() => mockBuilder)
}));

// Mock NotificationManager
jest.mock('../common/notification-manager.js', () => ({
  NotificationManager: {
    show: jest.fn()
  }
}));

// Mock CopyButton
const mockCopyButton = {
  updateVisibility: jest.fn(),
  forceUpdateVisibility: jest.fn()
};
jest.mock('../common/copy-button/CopyButton.js', () => {
  return jest.fn(() => mockCopyButton);
});

// Import after mocking
const scriptModule = jest.requireActual('./script.js');
const { NotificationManager } = jest.requireMock('../common/notification-manager.js');
const CopyButton = jest.requireMock('../common/copy-button/CopyButton.js');

describe('JWT Builder UI Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create a fresh DOM environment for each test
    document.body.innerHTML = `
      <div id="customClaims"></div>
      <pre id="result"></pre>
      <input id="key" value="test-key">
      <input id="iss" value="test-issuer">
      <input id="sub" value="test-subject">
      <input id="aud" value="test-audience">
      <input id="exp" value="2024-01-01T00:00:00Z">
      <input id="nbf" value="2023-12-31T00:00:00Z">
      <input id="iat" value="2023-12-31T00:00:00Z">
      <input id="jti" value="test-id">
    `;

    // Set up window.jwtBuilder before importing script
    window.jwtBuilder = mockBuilder;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    delete window.jwtBuilder;
  });

  describe('Initial Page Load', () => {
    test('initializes with default claims', () => {
      // Trigger DOMContentLoaded
      document.dispatchEvent(new Event('DOMContentLoaded'));

      // Verify default values were set
      expect(document.getElementById('iss').value).toBe('codesamplez.com');
      expect(document.getElementById('sub').value).toBe('your-subject');
      expect(document.getElementById('aud').value).toBe('your-audience');
      expect(document.getElementById('jti').value).toBe('your-indentifier');
    });

    test('initializes copy buttons for result and key input', () => {
      // Trigger DOMContentLoaded
      document.dispatchEvent(new Event('DOMContentLoaded'));

      // Verify CopyButton was called twice - once for result, once for key input
      expect(CopyButton).toHaveBeenCalledTimes(2);
      
      // Verify it was called with the result element
      expect(CopyButton).toHaveBeenCalledWith(document.getElementById('result'));
      
      // Verify it was called with the key input element
      expect(CopyButton).toHaveBeenCalledWith(document.getElementById('key'));
    });
  });

  describe('Custom Claims Management', () => {
    test('adds new custom claim row', () => {
      scriptModule.addClaim();
      const customClaimsDiv = document.getElementById('customClaims');
      const claimRow = customClaimsDiv.querySelector('.custom-claim-row');
      
      expect(claimRow).toBeTruthy();
      expect(claimRow.querySelector('input[name="claimName"]')).toBeTruthy();
      expect(claimRow.querySelector('input[name="claimValue"]')).toBeTruthy();
    });

    test('removes custom claim row', () => {
      scriptModule.addClaim();
      const customClaimsDiv = document.getElementById('customClaims');
      const claimRow = customClaimsDiv.querySelector('.custom-claim-row');
      const deleteButton = claimRow.querySelector('.delete-claim');
      
      scriptModule.removeClaim(deleteButton);
      
      expect(customClaimsDiv.querySelector('.custom-claim-row')).toBeNull();
      expect(customClaimsDiv.querySelector('.empty-claims-message')).toBeTruthy();
    });

    test('shows empty message when last claim is removed', () => {
      scriptModule.addClaim();
      scriptModule.addClaim();
      const customClaimsDiv = document.getElementById('customClaims');
      const claimRows = customClaimsDiv.querySelectorAll('.custom-claim-row');
      
      claimRows.forEach(row => {
        scriptModule.removeClaim(row.querySelector('.delete-claim'));
      });
      
      expect(customClaimsDiv.querySelector('.empty-claims-message')).toBeTruthy();
      expect(customClaimsDiv.querySelector('.empty-claims-message').textContent).toBe('No custom claims added yet');
    });
  });

  describe('JWT Building', () => {
    test('builds JWT with all claims and shows success notification', async () => {
      const jwt = await scriptModule.buildJWT();

      expect(mockBuilder.buildJWT).toHaveBeenCalledWith(
        expect.objectContaining({
          iss: 'test-issuer',
          sub: 'test-subject',
          aud: 'test-audience',
          exp: expect.any(Number),
          nbf: expect.any(Number),
          iat: expect.any(Number),
          jti: 'test-id'
        }),
        'test-key'
      );

      expect(document.getElementById('result').textContent).toBe('mocked.jwt.token');
      expect(NotificationManager.show).toHaveBeenCalledWith('JWT successfully built', 2000, { type: 'success' });
      expect(jwt).toBe('mocked.jwt.token');
    });

    test('handles custom claims', async () => {
      scriptModule.addClaim();
      const claimRow = document.querySelector('.custom-claim-row');
      claimRow.querySelector('input[name="claimName"]').value = 'role';
      claimRow.querySelector('input[name="claimValue"]').value = 'admin';

      const jwt = await scriptModule.buildJWT();

      expect(mockBuilder.buildJWT).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'admin'
        }),
        expect.any(String)
      );

      expect(jwt).toBe('mocked.jwt.token');
    });

    test('handles JSON custom claim values', async () => {
      scriptModule.addClaim();
      const claimRow = document.querySelector('.custom-claim-row');
      claimRow.querySelector('input[name="claimName"]').value = 'permissions';
      claimRow.querySelector('input[name="claimValue"]').value = '["read", "write"]';

      const jwt = await scriptModule.buildJWT();

      expect(mockBuilder.buildJWT).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: ['read', 'write']
        }),
        expect.any(String)
      );

      expect(jwt).toBe('mocked.jwt.token');
    });

    test('ignores custom claims with empty name or value', async () => {
      scriptModule.addClaim();
      const claimRow = document.querySelector('.custom-claim-row');
      claimRow.querySelector('input[name="claimName"]').value = '';
      claimRow.querySelector('input[name="claimValue"]').value = 'value';

      scriptModule.addClaim();
      const claimRow2 = document.querySelectorAll('.custom-claim-row')[1];
      claimRow2.querySelector('input[name="claimName"]').value = 'key';
      claimRow2.querySelector('input[name="claimValue"]').value = '';

      const jwt = await scriptModule.buildJWT();

      expect(mockBuilder.buildJWT).toHaveBeenCalledWith(
        expect.not.objectContaining({
          '': expect.anything(),
          'key': expect.anything()
        }),
        expect.any(String)
      );

      expect(jwt).toBe('mocked.jwt.token');
    });

    test('handles error when building JWT with invalid payload', async () => {
      mockBuilder.buildJWT.mockRejectedValue(new SyntaxError('Invalid JSON'));
      const jwt = await scriptModule.buildJWT();

      expect(document.getElementById('result').textContent).toBe('');
      expect(NotificationManager.show).toHaveBeenCalledWith('Invalid JSON payload.', 3000, { type: 'error' });
      expect(jwt).toBeNull();
    });

    test('handles generic error when building JWT', async () => {
      mockBuilder.buildJWT.mockRejectedValue(new Error('Generic error'));
      const jwt = await scriptModule.buildJWT();

      expect(document.getElementById('result').textContent).toBe('');
      expect(NotificationManager.show).toHaveBeenCalledWith('Error building JWT: Generic error', 3000, { type: 'error' });
      expect(jwt).toBeNull();
    });

    test('shows error notification when no secret key provided', async () => {
      document.getElementById('key').value = '';
      const jwt = await scriptModule.buildJWT();
      expect(document.getElementById('result').textContent).toBe('');
      expect(NotificationManager.show).toHaveBeenCalledWith('Error: Secret key is required for JWT signing', 3000, { type: 'error' });
      expect(jwt).toBeNull();
    });

    test('shows error notification when no issuer (iss) provided', async () => {
      document.getElementById('iss').value = '';
      const jwt = await scriptModule.buildJWT();
      expect(document.getElementById('result').textContent).toBe('');
      expect(NotificationManager.show).toHaveBeenCalledWith('Error: Issuer (iss) is required for JWT', 3000, { type: 'error' });
      expect(jwt).toBeNull();
    });

    test('shows error notification when no expiration time (exp) provided', async () => {
      document.getElementById('exp').value = '';
      const jwt = await scriptModule.buildJWT();
      expect(document.getElementById('result').textContent).toBe('');
      expect(NotificationManager.show).toHaveBeenCalledWith('Error: Expiration Time (exp) is required for JWT', 3000, { type: 'error' });
      expect(jwt).toBeNull();
    });
  });

  describe('Date Parsing', () => {
    test('handles invalid date input for exp', async () => {
      document.getElementById('exp').value = 'invalid-date';
      mockBuilder.parseDateTime.mockReturnValue(null);

      const jwt = await scriptModule.buildJWT();

      expect(mockBuilder.buildJWT).toHaveBeenCalledWith(
        expect.not.objectContaining({
          exp: expect.any(Number)
        }),
        expect.any(String)
      );

      expect(jwt).toBeNull();
    });

    test('handles invalid date input for nbf', async () => {
      document.getElementById('nbf').value = 'invalid-date';
      mockBuilder.parseDateTime.mockReturnValue(null);

      const jwt = await scriptModule.buildJWT();

      expect(mockBuilder.buildJWT).toHaveBeenCalledWith(
        expect.not.objectContaining({
          nbf: expect.any(Number)
        }),
        expect.any(String)
      );

      expect(jwt).toBeNull();
    });

    test('handles invalid date input for iat', async () => {
      document.getElementById('iat').value = 'invalid-date';
      mockBuilder.parseDateTime.mockReturnValue(null);

      const jwt = await scriptModule.buildJWT();

      expect(mockBuilder.buildJWT).toHaveBeenCalledWith(
        expect.not.objectContaining({
          iat: expect.any(Number)
        }),
        expect.any(String)
      );

      expect(jwt).toBeNull();
    });
  });

  describe('Random Secret Generation', () => {
    beforeEach(() => {
      mockBuilder.generateRandomSecret = jest.fn().mockReturnValue('random-secret-key-32-chars-long!!');
    });

    test('generates random secret and updates input field', () => {
      const keyInput = document.getElementById('key');
      keyInput.value = 'old-secret';
      
      const result = scriptModule.generateRandomSecret();
      
      expect(keyInput.value).toBe('random-secret-key-32-chars-long!!');
      expect(NotificationManager.show).toHaveBeenCalledWith('Random secret generated', 2000, { type: 'success' });
      expect(result).toBe('random-secret-key-32-chars-long!!');
    });

    test('returns null when key input element does not exist', () => {
      document.getElementById('key').remove();
      const result = scriptModule.generateRandomSecret();
      
      expect(result).toBeNull();
    });
  });
});
