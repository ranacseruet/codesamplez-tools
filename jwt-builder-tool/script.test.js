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
  getFormattedDate: jest.fn().mockReturnValue('2024-01-01T00:00:00Z')
};

// Mock modules
jest.mock('./JWTBuilder.js', () => ({
  JWTBuilder: jest.fn(() => mockBuilder)
}));

// Import after mocking
const scriptModule = jest.requireActual('./script.js');

describe('JWT Builder UI Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create a fresh DOM environment for each test
    document.body.innerHTML = `
      <div id="customClaims"></div>
      <div id="result"></div>
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
    test('builds JWT with all claims', async () => {
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

    test('shows error when no secret key provided', async () => {
      document.getElementById('key').value = '';
      const jwt = await scriptModule.buildJWT();
      expect(document.getElementById('result').textContent).toBe('Error: Secret key is required for JWT signing');
      expect(jwt).toBeNull();
    });
  });

  describe('JWT Copying', () => {
    beforeEach(() => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn()
        }
      });
      
      // Add copy button
      document.body.innerHTML += '<button id="copyJwtBtn">Copy</button>';
    });

    test('copies JWT to clipboard', async () => {
      document.getElementById('result').textContent = 'test.jwt.token';
      const result = await scriptModule.copyJWT();
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test.jwt.token');
      expect(document.getElementById('copyJwtBtn').textContent).toBe('Copied!');
      expect(result).toBe(true);
    });

    test('does not copy when result contains error', async () => {
      document.getElementById('result').textContent = 'Error: Invalid token';
      const result = await scriptModule.copyJWT();
      
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      expect(document.getElementById('copyJwtBtn').textContent).not.toBe('Copied!');
      expect(result).toBe(false);
    });

    test('button text returns to original after timeout', async () => {
      jest.useFakeTimers();
      
      document.getElementById('result').textContent = 'test.jwt.token';
      const copyButton = document.getElementById('copyJwtBtn');
      copyButton.textContent = 'Copy JWT';
      
      const result = await scriptModule.copyJWT();
      expect(copyButton.textContent).toBe('Copied!');
      expect(result).toBe(true);
      
      jest.advanceTimersByTime(2000);
      expect(copyButton.textContent).toBe('Copy JWT');
      
      jest.useRealTimers();
    });
  });
});
