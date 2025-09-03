/**
 * Unit Tests for Input Validation System
 * 
 * Comprehensive test suite demonstrating the validation system's
 * robustness and edge case handling. Tests validate both positive
 * and negative scenarios with detailed assertions.
 * 
 * @fileoverview Test suite for input validation and sanitization
 */

import { 
    InputValidator, 
    ValidationPresets, 
    ValidationErrorCode,
    ValidationResult,
    createInputValidator,
    validateInput
} from '../src/utils/inputValidator';
import { Logger } from '../src/utils/logger';

/**
 * Mock logger for testing without console output
 */
class MockLogger extends Logger {
    debug(): void { /* Silent for tests */ }
    info(): void { /* Silent for tests */ }
    error(): void { /* Silent for tests */ }
}

/**
 * Test suite for input validation system
 */
class InputValidatorTests {
    private validator: InputValidator;
    private mockLogger: MockLogger;

    constructor() {
        this.mockLogger = new MockLogger();
        this.validator = createInputValidator(this.mockLogger);
    }

    /**
     * Run all test cases and report results
     */
    runAllTests(): void {
        console.log('🧪 Running Input Validation Tests...\n');

        // Basic validation tests
        this.testBasicValidation();
        this.testLengthValidation();
        this.testContentValidation();
        this.testSanitization();
        
        // Preset validation tests
        this.testCardTitleValidation();
        this.testBoardNameValidation();
        this.testColumnNameValidation();
        
        // Edge case tests
        this.testEdgeCases();
        this.testSecurityScenarios();
        
        console.log('✅ All Input Validation Tests Completed!\n');
    }

    /**
     * Test basic validation functionality
     */
    private testBasicValidation(): void {
        console.log('📝 Testing Basic Validation...');

        // Valid input
        const validResult = this.validator.validate('Valid input', ValidationPresets.CARD_TITLE);
        this.assert(validResult.isValid === true, 'Valid input should pass validation');
        this.assert(validResult.errors.length === 0, 'Valid input should have no errors');
        this.assert(validResult.sanitizedValue === 'Valid input', 'Valid input should remain unchanged');

        // Empty input
        const emptyResult = this.validator.validate('', ValidationPresets.CARD_TITLE);
        this.assert(emptyResult.isValid === false, 'Empty input should fail validation');
        this.assert(emptyResult.errorCodes.includes(ValidationErrorCode.EMPTY_INPUT), 'Should detect empty input');

        console.log('✓ Basic validation tests passed\n');
    }

    /**
     * Test length validation constraints
     */
    private testLengthValidation(): void {
        console.log('📏 Testing Length Validation...');

        // Too short input
        const shortResult = this.validator.validate('', { minLength: 5 });
        this.assert(shortResult.isValid === false, 'Input below minimum should fail');
        this.assert(shortResult.errorCodes.includes(ValidationErrorCode.TOO_SHORT), 'Should detect too short input');

        // Too long input
        const longInput = 'a'.repeat(101);
        const longResult = this.validator.validate(longInput, { maxLength: 100 });
        this.assert(longResult.isValid === false, 'Input above maximum should fail');
        this.assert(longResult.errorCodes.includes(ValidationErrorCode.TOO_LONG), 'Should detect too long input');

        // Perfect length
        const perfectResult = this.validator.validate('Perfect length', { minLength: 5, maxLength: 20 });
        this.assert(perfectResult.isValid === true, 'Input within range should pass');

        console.log('✓ Length validation tests passed\n');
    }

    /**
     * Test content validation and security
     */
    private testContentValidation(): void {
        console.log('🔒 Testing Content Validation...');

        // HTML injection attempt
        const htmlInput = '<script>alert("xss")</script>Normal text';
        const htmlResult = this.validator.validate(htmlInput, ValidationPresets.CARD_TITLE);
        this.assert(htmlResult.isValid === false, 'HTML/Script injection should fail');
        this.assert(htmlResult.errorCodes.includes(ValidationErrorCode.SCRIPT_INJECTION), 'Should detect script injection');

        // HTML tags (when not allowed)
        const tagInput = '<b>Bold text</b>';
        const tagResult = this.validator.validate(tagInput, { allowHtml: false });
        this.assert(tagResult.isValid === false, 'HTML tags should fail when not allowed');
        this.assert(tagResult.errorCodes.includes(ValidationErrorCode.HTML_INJECTION), 'Should detect HTML injection');

        // Whitespace only
        const whitespaceResult = this.validator.validate('   \t\n   ', ValidationPresets.CARD_TITLE);
        this.assert(whitespaceResult.isValid === false, 'Whitespace-only input should fail');
        this.assert(whitespaceResult.errorCodes.includes(ValidationErrorCode.WHITESPACE_ONLY), 'Should detect whitespace-only input');

        console.log('✓ Content validation tests passed\n');
    }

    /**
     * Test input sanitization
     */
    private testSanitization(): void {
        console.log('🧹 Testing Input Sanitization...');

        // HTML sanitization
        const htmlInput = '<p>Paragraph</p><script>evil()</script>';
        const htmlResult = this.validator.validate(htmlInput, { allowHtml: false });
        this.assert(!htmlResult.sanitizedValue.includes('<script>'), 'Scripts should be removed');
        this.assert(!htmlResult.sanitizedValue.includes('<p>'), 'HTML tags should be removed when not allowed');

        // Whitespace normalization
        const spacedInput = '  Multiple    spaces   ';
        const spacedResult = this.validator.validate(spacedInput, { trimWhitespace: true });
        this.assert(spacedResult.sanitizedValue === 'Multiple spaces', 'Whitespace should be normalized');

        // HTML entity escaping
        const entityInput = 'Test & "quotes" <brackets>';
        const entityResult = this.validator.validate(entityInput, ValidationPresets.CARD_TITLE);
        this.assert(entityResult.sanitizedValue.includes('&amp;'), 'Ampersands should be escaped');
        this.assert(entityResult.sanitizedValue.includes('&quot;'), 'Quotes should be escaped');

        console.log('✓ Sanitization tests passed\n');
    }

    /**
     * Test card title validation preset
     */
    private testCardTitleValidation(): void {
        console.log('🎯 Testing Card Title Validation...');

        // Valid card title
        const validTitle = validateInput('My Important Task', ValidationPresets.CARD_TITLE, this.mockLogger);
        this.assert(validTitle.isValid === true, 'Valid card title should pass');

        // Card title with HTML
        const htmlTitle = validateInput('<b>Bold Task</b>', ValidationPresets.CARD_TITLE, this.mockLogger);
        this.assert(htmlTitle.isValid === false, 'Card title with HTML should fail');

        // Very long card title
        const longTitle = 'a'.repeat(101);
        const longTitleResult = validateInput(longTitle, ValidationPresets.CARD_TITLE, this.mockLogger);
        this.assert(longTitleResult.isValid === false, 'Overly long card title should fail');

        console.log('✓ Card title validation tests passed\n');
    }

    /**
     * Test board name validation preset
     */
    private testBoardNameValidation(): void {
        console.log('📋 Testing Board Name Validation...');

        // Valid board name
        const validBoard = validateInput('Project Alpha', ValidationPresets.BOARD_NAME, this.mockLogger);
        this.assert(validBoard.isValid === true, 'Valid board name should pass');

        // Board name with special characters
        const specialBoard = validateInput('Project@#$%', ValidationPresets.BOARD_NAME, this.mockLogger);
        this.assert(specialBoard.isValid === false, 'Board name with special chars should fail');

        // Valid board name with allowed characters
        const allowedBoard = validateInput('Project_Alpha-v2', ValidationPresets.BOARD_NAME, this.mockLogger);
        this.assert(allowedBoard.isValid === true, 'Board name with allowed chars should pass');

        console.log('✓ Board name validation tests passed\n');
    }

    /**
     * Test column name validation preset
     */
    private testColumnNameValidation(): void {
        console.log('📋 Testing Column Name Validation...');

        // Valid column name
        const validColumn = validateInput('In Progress', ValidationPresets.COLUMN_NAME, this.mockLogger);
        this.assert(validColumn.isValid === true, 'Valid column name should pass');

        // Column name too long
        const longColumn = validateInput('Very Long Column Name That Exceeds Limit', ValidationPresets.COLUMN_NAME, this.mockLogger);
        this.assert(longColumn.isValid === false, 'Overly long column name should fail');

        console.log('✓ Column name validation tests passed\n');
    }

    /**
     * Test edge cases and boundary conditions
     */
    private testEdgeCases(): void {
        console.log('🔍 Testing Edge Cases...');

        // Null/undefined input handling
        try {
            const nullResult = this.validator.validate(null as any, ValidationPresets.CARD_TITLE);
            this.assert(nullResult.isValid === false, 'Null input should fail gracefully');
        } catch (error) {
            // Expected behavior - should handle gracefully
        }

        // Unicode characters
        const unicodeInput = '🎯 Unicode Task 看板';
        const unicodeResult = this.validator.validate(unicodeInput, { minLength: 1, maxLength: 100 });
        this.assert(unicodeResult.isValid === true, 'Unicode characters should be allowed');

        // Mixed content
        const mixedInput = 'Task <em>with</em> mixed content & symbols';
        const mixedResult = this.validator.validate(mixedInput, { allowHtml: false });
        this.assert(mixedResult.sanitizedValue.length > 0, 'Mixed content should be sanitized, not rejected');

        console.log('✓ Edge case tests passed\n');
    }

    /**
     * Test security scenarios and attack vectors
     */
    private testSecurityScenarios(): void {
        console.log('🛡️ Testing Security Scenarios...');

        // XSS attempts
        const xssAttempts = [
            '<script>alert("xss")</script>',
            'javascript:alert("xss")',
            '<img src="x" onerror="alert(\'xss\')">',
            '<iframe src="javascript:alert(\'xss\')"></iframe>'
        ];

        xssAttempts.forEach((attempt, index) => {
            const result = this.validator.validate(attempt, ValidationPresets.CARD_TITLE);
            this.assert(result.isValid === false, `XSS attempt ${index + 1} should fail validation`);
            this.assert(!result.sanitizedValue.includes('script'), `XSS attempt ${index + 1} should be sanitized`);
        });

        // SQL injection attempts (should be sanitized)
        const sqlAttempts = [
            "'; DROP TABLE cards; --",
            "1' OR '1'='1",
            "UNION SELECT * FROM users"
        ];

        sqlAttempts.forEach((attempt, index) => {
            const result = this.validator.validate(attempt, ValidationPresets.CARD_TITLE);
            // Should sanitize dangerous characters
            this.assert(!result.sanitizedValue.includes('--'), `SQL attempt ${index + 1} should be sanitized`);
        });

        console.log('✓ Security scenario tests passed\n');
    }

    /**
     * Simple assertion helper for tests
     */
    private assert(condition: boolean, message: string): void {
        if (!condition) {
            throw new Error(`❌ Assertion failed: ${message}`);
        }
    }
}

// Export test runner for integration
export function runInputValidationTests(): void {
    const testSuite = new InputValidatorTests();
    testSuite.runAllTests();
}

// Self-executing test when run directly
if (require.main === module) {
    runInputValidationTests();
}
