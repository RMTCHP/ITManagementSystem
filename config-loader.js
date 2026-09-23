(function () {
    // Load the central runtime configuration fresh on each page load.
    document.write(`<script src="config.js?v=${Date.now()}"><\/script>`);
}());
