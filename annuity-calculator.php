<?php
/*
Plugin Name: Annuity Calculator
Plugin URI: https://ashen-coder.github.io/annuity-calculator/
Description: Annuity calculator 
Version: 1.0.1
Author: Ashen Coder
Author URI: https://github.com/ashen-coder
License: GPLv2 or later
Update URI: https://github.com/ashen-coder/annuity-calculator
*/

if (!defined('ABSPATH')) exit;

if (!function_exists('add_shortcode')) return "No direct call for Annuity Calculator";

function display_ac_annuity_calculator(){
    $plugin_dir_path = plugin_dir_path(__FILE__);
    $scripts_and_styles = array(
        'assets/css/main.css',
        'assets/css/input.css',
        'assets/css/result.css',
        'assets/js/app.js',
        'assets/js/dialog-table.js',
    );

    $html_content = file_get_contents($plugin_dir_path . 'index.html');

    foreach ($scripts_and_styles as $filename) {
        $link = add_query_arg('ts', time(), plugins_url($filename, __FILE__));
        $html_content = str_replace('./' . $filename, $link, $html_content);
    }

    return $html_content;
}

add_shortcode( 'ac_annuity_calculator', 'display_ac_annuity_calculator' );