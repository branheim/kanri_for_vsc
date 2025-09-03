/**
 * Input Validation and Sanitization System
 * 
 * This module provides comprehensive input validation for the Kanri extension,
 * ensuring data integrity and security across all user inputs. The system
 * follows the strategy pattern for extensible validation rules.
 * 
 * @fileoverview Modular input validation with sanitization capabilities
 * @author Brandon Heimbigner
 * @version 1.0.0
 */

import { Logger } from './logger';

/**
 * Validation result interface for consistent error handling
 * Provides structured feedback for UI components and error reporting
 */
export interface ValidationResult {
    /** Whether the input passed validation */
    isValid: boolean;
    /** Sanitized version of the input (safe to use) */
    sanitizedValue: string;
    /** Human-readable error messages for UI display */
    errors: string[];
    /** Technical error codes for programmatic handling */
    errorCodes: ValidationErrorCode[];
}

/**
 * Enumeration of validation error types
 * Enables precise error handling and internationalization
 */
export enum ValidationErrorCode {
    EMPTY_INPUT = 'EMPTY_INPUT',
    TOO_LONG = 'TOO_LONG',
    TOO_SHORT = 'TOO_SHORT',
    INVALID_CHARACTERS = 'INVALID_CHARACTERS',
    HTML_INJECTION = 'HTML_INJECTION',
    SCRIPT_INJECTION = 'SCRIPT_INJECTION',
    PROFANITY_DETECTED = 'PROFANITY_DETECTED',
    WHITESPACE_ONLY = 'WHITESPACE_ONLY'
}

/**
 * Configuration interface for validation rules
 * Allows customization of validation behavior per use case
 */
export interface ValidationConfig {
    /** Minimum allowed length (default: 1) */
    minLength?: number;
    /** Maximum allowed length (default: 100) */
    maxLength?: number;
    /** Whether to allow HTML tags (default: false) */
    allowHtml?: boolean;
    /** Whether to allow scripts (default: false) */
    allowScripts?: boolean;
    /** Custom regex pattern for allowed characters */
    allowedPattern?: RegExp;
    /** Whether to trim whitespace (default: true) */
    trimWhitespace?: boolean;
    /** Whether to check for profanity (default: false) */
    checkProfanity?: boolean;
}

/**
 * Abstract base class for validation strategies
 * Implements the Strategy pattern for extensible validation rules
 */
abstract class ValidationStrategy {
    protected config: ValidationConfig;
    protected logger: Logger;

    constructor(config: ValidationConfig, logger: Logger) {
        this.config = config;
        this.logger = logger;
    }

    /**
     * Execute validation strategy
     * @param input Raw user input to validate
     * @returns Partial validation result for this strategy
     */
    abstract validate(input: string): Partial<ValidationResult>;
}

/**
 * Length validation strategy
 * Ensures input meets minimum and maximum length requirements
 */
class LengthValidationStrategy extends ValidationStrategy {
    validate(input: string): Partial<ValidationResult> {
        const errors: string[] = [];
        const errorCodes: ValidationErrorCode[] = [];
        
        // Check for empty input
        if (!input || input.length === 0) {
            errors.push('Input cannot be empty');
            errorCodes.push(ValidationErrorCode.EMPTY_INPUT);
            return { isValid: false, errors, errorCodes };
        }

        // Check minimum length
        const minLength = this.config.minLength ?? 1;
        if (input.length < minLength) {
            errors.push(`Input must be at least ${minLength} character${minLength > 1 ? 's' : ''} long`);
            errorCodes.push(ValidationErrorCode.TOO_SHORT);
        }

        // Check maximum length
        const maxLength = this.config.maxLength ?? 100;
        if (input.length > maxLength) {
            errors.push(`Input cannot exceed ${maxLength} characters`);
            errorCodes.push(ValidationErrorCode.TOO_LONG);
        }

        return {
            isValid: errors.length === 0,
            errors,
            errorCodes
        };
    }
}

/**
 * Content validation strategy
 * Checks for malicious content, HTML injection, and script injection
 */
class ContentValidationStrategy extends ValidationStrategy {
    private readonly htmlPattern = /<[^>]*>/g;
    private readonly scriptPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
    
    validate(input: string): Partial<ValidationResult> {
        const errors: string[] = [];
        const errorCodes: ValidationErrorCode[] = [];

        // Check for whitespace-only input
        if (input.trim().length === 0) {
            errors.push('Input cannot contain only whitespace');
            errorCodes.push(ValidationErrorCode.WHITESPACE_ONLY);
            return { isValid: false, errors, errorCodes };
        }

        // Check for HTML tags if not allowed
        if (!this.config.allowHtml && this.htmlPattern.test(input)) {
            errors.push('HTML tags are not allowed');
            errorCodes.push(ValidationErrorCode.HTML_INJECTION);
        }

        // Check for script tags (always forbidden for security)
        if (this.scriptPattern.test(input)) {
            errors.push('Script tags are forbidden for security reasons');
            errorCodes.push(ValidationErrorCode.SCRIPT_INJECTION);
        }

        // Check against allowed character pattern
        if (this.config.allowedPattern && !this.config.allowedPattern.test(input)) {
            errors.push('Input contains invalid characters');
            errorCodes.push(ValidationErrorCode.INVALID_CHARACTERS);
        }

        return {
            isValid: errors.length === 0,
            errors,
            errorCodes
        };
    }
}

/**
 * Sanitization utility class
 * Provides safe cleaning of user input while preserving intended content
 */
class InputSanitizer {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * Sanitize input by removing/escaping dangerous content
     * @param input Raw user input
     * @param config Sanitization configuration
     * @returns Sanitized string safe for storage and display
     */
    sanitize(input: string, config: ValidationConfig): string {
        let sanitized = input;

        // Trim whitespace if configured
        if (config.trimWhitespace !== false) {
            sanitized = sanitized.trim();
        }

        // Remove HTML tags if not allowed
        if (!config.allowHtml) {
            sanitized = sanitized.replace(/<[^>]*>/g, '');
        }

        // Always remove script tags for security
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

        // Escape remaining HTML entities for safety
        sanitized = this.escapeHtml(sanitized);

        // Normalize whitespace
        sanitized = sanitized.replace(/\s+/g, ' ');

        this.logger.debug(`Input sanitized: "${input}" -> "${sanitized}"`);
        return sanitized;
    }

    /**
     * Escape HTML entities to prevent XSS attacks
     * @param input String to escape
     * @returns HTML-escaped string
     */
    private escapeHtml(input: string): string {
        const entityMap: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;'
        };

        return input.replace(/[&<>"'\/]/g, (char) => entityMap[char]);
    }
}

/**
 * Main input validator class
 * Orchestrates validation strategies and provides a unified interface
 */
export class InputValidator {
    private strategies: ValidationStrategy[] = [];
    private sanitizer: InputSanitizer;
    private logger: Logger;

    constructor(logger: Logger = new Logger()) {
        this.logger = logger;
        this.sanitizer = new InputSanitizer(logger);
    }

    /**
     * Validate input using configured strategies
     * @param input Raw user input to validate
     * @param config Validation configuration
     * @returns Complete validation result with sanitized value
     */
    validate(input: string, config: ValidationConfig = {}): ValidationResult {
        const startTime = Date.now();
        
        // Initialize validation strategies
        this.initializeStrategies(config);

        // Collect results from all strategies
        const allErrors: string[] = [];
        const allErrorCodes: ValidationErrorCode[] = [];
        let isValid = true;

        // Execute each validation strategy
        for (const strategy of this.strategies) {
            const result = strategy.validate(input);
            
            if (result.isValid === false) {
                isValid = false;
            }
            
            if (result.errors) {
                allErrors.push(...result.errors);
            }
            
            if (result.errorCodes) {
                allErrorCodes.push(...result.errorCodes);
            }
        }

        // Sanitize input regardless of validation result
        const sanitizedValue = this.sanitizer.sanitize(input, config);

        const processingTime = Date.now() - startTime;
        this.logger.debug(`Input validation completed in ${processingTime}ms`);

        return {
            isValid,
            sanitizedValue,
            errors: allErrors,
            errorCodes: allErrorCodes
        };
    }

    /**
     * Initialize validation strategies based on configuration
     * @param config Validation configuration
     */
    private initializeStrategies(config: ValidationConfig): void {
        this.strategies = [
            new LengthValidationStrategy(config, this.logger),
            new ContentValidationStrategy(config, this.logger)
        ];
    }
}

/**
 * Predefined validation configurations for common use cases
 * Provides convenient presets while allowing customization
 */
export class ValidationPresets {
    /**
     * Configuration for card titles
     * Allows moderate length with basic character restrictions
     */
    static readonly CARD_TITLE: ValidationConfig = {
        minLength: 1,
        maxLength: 100,
        allowHtml: false,
        allowScripts: false,
        trimWhitespace: true,
        checkProfanity: false
    };

    /**
     * Configuration for card descriptions
     * Allows longer text with some formatting
     */
    static readonly CARD_DESCRIPTION: ValidationConfig = {
        minLength: 0,
        maxLength: 1000,
        allowHtml: false,
        allowScripts: false,
        trimWhitespace: true,
        checkProfanity: false
    };

    /**
     * Configuration for board names
     * Strict validation for critical identifiers
     */
    static readonly BOARD_NAME: ValidationConfig = {
        minLength: 1,
        maxLength: 50,
        allowHtml: false,
        allowScripts: false,
        trimWhitespace: true,
        allowedPattern: /^[a-zA-Z0-9\s\-_]+$/,
        checkProfanity: false
    };

    /**
     * Configuration for column names
     * Moderate restrictions for workflow labels
     */
    static readonly COLUMN_NAME: ValidationConfig = {
        minLength: 1,
        maxLength: 30,
        allowHtml: false,
        allowScripts: false,
        trimWhitespace: true,
        allowedPattern: /^[a-zA-Z0-9\s\-_]+$/,
        checkProfanity: false
    };
}

/**
 * Factory function for creating input validators
 * Provides dependency injection and consistent initialization
 */
export function createInputValidator(logger?: Logger): InputValidator {
    return new InputValidator(logger);
}

/**
 * Utility function for quick validation with presets
 * Convenient for common validation scenarios
 */
export function validateInput(
    input: string, 
    preset: ValidationConfig, 
    logger?: Logger
): ValidationResult {
    const validator = createInputValidator(logger);
    return validator.validate(input, preset);
}
