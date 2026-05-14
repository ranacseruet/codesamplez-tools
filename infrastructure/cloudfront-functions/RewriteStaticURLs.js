// CloudFront Function Code to Handle Static Site URLs
// Note: CloudFront Functions use a restricted JS runtime - no endsWith/includes
function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Check if the URI ends with '/' - append 'index.html'
    var lastChar = uri.charAt(uri.length - 1);
    if (lastChar === '/') {
        request.uri += 'index.html';
    }
    // Check if the URI has no file extension (no '.' after last '/') - append '.html'
    else {
        var lastSlashIndex = uri.lastIndexOf('/');
        var pathAfterSlash = uri.substring(lastSlashIndex + 1);
        if (pathAfterSlash.indexOf('.') === -1) {
            request.uri += '.html';
        }
    }

    return request;
}
