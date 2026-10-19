// CloudFront Function Code to Handle Static Site URLs
// Note: CloudFront Functions use a restricted JS runtime - no endsWith/includes
function appendQueryString(location, querystring) {
    if (!querystring) {
        return location;
    }

    if (typeof querystring === 'string') {
        return querystring.length > 0 ? location + '?' + querystring : location;
    }

    var queryParts = [];
    for (var name in querystring) {
        var parameter = querystring[name];
        if (parameter.multiValue) {
            for (var i = 0; i < parameter.multiValue.length; i++) {
                queryParts.push(encodeURIComponent(name) + '=' + encodeURIComponent(parameter.multiValue[i].value));
            }
        } else {
            queryParts.push(encodeURIComponent(name) + '=' + encodeURIComponent(parameter.value));
        }
    }

    return queryParts.length > 0 ? location + '?' + queryParts.join('&') : location;
}

// Legacy tool slugs → canonical directory URLs (trailing slash). Add confirmed aliases here.
var LEGACY_SLUG_ALIASES = {
    '/javascript-minifier': '/js-minifier/'
};

function getLegacyAliasTarget(uri) {
    var target = LEGACY_SLUG_ALIASES[uri];
    if (target) {
        return target;
    }

    var lastChar = uri.charAt(uri.length - 1);
    if (lastChar === '/') {
        if (uri.length === 1) {
            return null;
        }
        return LEGACY_SLUG_ALIASES[uri.substring(0, uri.length - 1)];
    }

    var indexHtmlSuffix = 'index.html';
    var indexHtmlSuffixLength = indexHtmlSuffix.length;
    if (uri.length > indexHtmlSuffixLength
        && uri.substring(uri.length - indexHtmlSuffixLength) === indexHtmlSuffix
        && uri.charAt(uri.length - indexHtmlSuffixLength - 1) === '/') {
        var legacyDirectoryPath = uri.substring(0, uri.length - indexHtmlSuffixLength - 1);
        return LEGACY_SLUG_ALIASES[legacyDirectoryPath];
    }

    return null;
}

function handler(event) {
    var request = event.request;
    var uri = request.uri;

    var legacyAliasTarget = getLegacyAliasTarget(uri);
    if (legacyAliasTarget) {
        var aliasLocation = appendQueryString(legacyAliasTarget, request.querystring);
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                location: {
                    value: aliasLocation
                }
            }
        };
    }

    // Redirect explicit /index.html URLs to the canonical directory URL.
    var indexHtmlSuffix = 'index.html';
    var indexHtmlSuffixLength = indexHtmlSuffix.length;
    if (uri.length > indexHtmlSuffixLength
        && uri.substring(uri.length - indexHtmlSuffixLength) === indexHtmlSuffix
        && uri.charAt(uri.length - indexHtmlSuffixLength - 1) === '/') {
        var directoryPath = uri.substring(0, uri.length - indexHtmlSuffixLength);
        var location = appendQueryString(directoryPath, request.querystring);
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                location: {
                    value: location
                }
            }
        };
    }

    // Check if the URI ends with '/' - append 'index.html'
    var lastChar = uri.charAt(uri.length - 1);
    if (lastChar === '/') {
        request.uri += 'index.html';
    }
    // Check if the URI has no file extension (no '.' after last '/') - redirect to the canonical directory URL
    else {
        var lastSlashIndex = uri.lastIndexOf('/');
        var pathAfterSlash = uri.substring(lastSlashIndex + 1);
        if (pathAfterSlash.indexOf('.') === -1) {
            var location = appendQueryString(uri + '/', request.querystring);
            return {
                statusCode: 301,
                statusDescription: 'Moved Permanently',
                headers: {
                    location: {
                        value: location
                    }
                }
            };
        }
    }

    return request;
}
