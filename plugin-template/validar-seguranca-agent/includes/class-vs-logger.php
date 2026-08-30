<?php

if (!defined('ABSPATH')) {
    exit;
}

class VS_Agent_Logger {

    private static $log_dir = null;
    private static $log_file = null;

    public static function init() {
        self::$log_dir  = WP_CONTENT_DIR . '/uploads/wp-patropi-logs';
        self::$log_file = self::$log_dir . '/debug.log';

        if (get_option('vs_logging_enabled', 0)) {
            self::enable_error_logging();
        }
    }

    public static function enable_error_logging() {
        if (!file_exists(self::$log_dir)) {
            wp_mkdir_p(self::$log_dir);
            // Protect directory from direct HTTP listing/access
            @file_put_contents(self::$log_dir . '/.htaccess', "Order deny,allow\nDeny from all\n");
            @file_put_contents(self::$log_dir . '/index.php', '<?php // Silence is golden');
        }

        // Configure PHP error logging directives safely
        @error_reporting(E_ALL);
        @ini_set('log_errors', 1);
        @ini_set('error_log', self::$log_file);
        @ini_set('display_errors', 0);

        // Register custom shutdown & error handlers to capture all errors
        set_error_handler(array(__CLASS__, 'handle_error'), E_ALL);
        register_shutdown_function(array(__CLASS__, 'handle_shutdown'));
    }

    public static function handle_error($errno, $errstr, $errfile, $errline) {
        if (!(error_reporting() & $errno)) {
            return false;
        }

        $type_str = self::get_error_type_name($errno);
        $date     = date('d-M-Y H:i:s T');
        $message  = sprintf("[%s] PHP %s: %s in %s on line %d\n", $date, $type_str, $errstr, $errfile, $errline);

        @error_log($message, 3, self::$log_file);
        return false; // Don't prevent internal PHP execution
    }

    public static function handle_shutdown() {
        $error = error_get_last();
        if ($error !== null && in_array($error['type'], array(E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR))) {
            $type_str = self::get_error_type_name($error['type']);
            $date     = date('d-M-Y H:i:s T');
            $message  = sprintf("[%s] PHP %s: %s in %s on line %d\n", $date, $type_str, $error['message'], $error['file'], $error['line']);
            @error_log($message, 3, self::$log_file);
        }
    }

    public static function get_error_type_name($errno) {
        switch ($errno) {
            case E_ERROR:
            case E_PARSE:
            case E_CORE_ERROR:
            case E_COMPILE_ERROR:
            case E_USER_ERROR:
                return 'Fatal error';
            case E_WARNING:
            case E_CORE_WARNING:
            case E_COMPILE_WARNING:
            case E_USER_WARNING:
                return 'Warning';
            case E_NOTICE:
            case E_USER_NOTICE:
                return 'Notice';
            case E_DEPRECATED:
            case E_USER_DEPRECATED:
                return 'Deprecated';
            case E_STRICT:
                return 'Strict Notice';
            default:
                return 'Error';
        }
    }

    public static function get_log_file_path() {
        if (null === self::$log_file) {
            self::$log_dir  = WP_CONTENT_DIR . '/uploads/wp-patropi-logs';
            self::$log_file = self::$log_dir . '/debug.log';
        }
        return self::$log_file;
    }

    public static function clear_logs() {
        $file = self::get_log_file_path();
        if (file_exists($file)) {
            @file_put_contents($file, '');
            return true;
        }
        return false;
    }

    public static function get_logs($limit = 100, $filter_level = 'all') {
        $file = self::get_log_file_path();
        if (!file_exists($file) || !is_readable($file)) {
            return array();
        }

        $content = @file_get_contents($file);
        if (empty($content)) {
            return array();
        }

        $raw_lines = explode("\n", trim($content));
        $raw_lines = array_reverse($raw_lines); // Newest logs first

        $parsed_logs = array();
        $count = 0;

        foreach ($raw_lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            $level = 'Other';
            if (stripos($line, 'Fatal error') !== false || stripos($line, 'Parse error') !== false) {
                $level = 'Fatal';
            } elseif (stripos($line, 'Warning') !== false) {
                $level = 'Warning';
            } elseif (stripos($line, 'Notice') !== false) {
                $level = 'Notice';
            } elseif (stripos($line, 'Deprecated') !== false) {
                $level = 'Deprecated';
            }

            if ($filter_level !== 'all' && strtolower($filter_level) !== strtolower($level)) {
                continue;
            }

            // Extract date timestamp if available [29-Aug-2026 22:00:00 UTC]
            $timestamp = '';
            if (preg_match('/^\[(.*?)\]/', $line, $matches)) {
                $timestamp = $matches[1];
                $message   = trim(substr($line, strlen($matches[0])));
            } else {
                $message   = $line;
            }

            $parsed_logs[] = array(
                'timestamp' => $timestamp ?: date('Y-m-d H:i:s'),
                'level'     => $level,
                'raw_line'  => $line,
                'message'   => $message,
            );

            $count++;
            if ($count >= $limit) {
                break;
            }
        }

        return $parsed_logs;
    }
}
