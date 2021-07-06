/**
 * @file
 * Provides Intersection Observer API loader.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
 * @see https://developers.google.com/web/updates/2016/04/intersectionobserver
 */

/* global define, module */
(function(root, factory) {

    'use strict';

    // Inspired by https://github.com/addyosmani/memoize.js/blob/master/memoize.js
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([window.dBlazy], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but only CommonJS-like
        // environments that support module.exports, like Node.
        module.exports = factory(window.dBlazy);
    } else {
        // Browser globals (root is window).
        root.Bio = factory(window.dBlazy);
    }
})(this, function(dBlazy) {

    'use strict';

    /**
     * Private variables.
     */
    var _doc = document;
    var _db = dBlazy;
    var _bioTick = 0;
    var _revTick = 0;
    var _disconnected = false;
    var _observed = false;

    /**
     * Constructor for Bio, Blazy IntersectionObserver.
     *
     * @param {object} options
     *   The Bio options.
     *
     * @namespace
     */
    function Bio(options) {
        var me = this;

        me.options = _db.extend({}, me.defaults, options || {});

        // Initializes Blazy IntersectionObserver.
        _disconnected = false;
        _observed = false;
        init(me);
    }

    // Cache our prototype.
    var _proto = Bio.prototype;
    _proto.constructor = Bio;

    // Prepare prototype to interchange with Blazy as fallback.
    _proto.count = 0;
    _proto.counted = -1;
    _proto.erCounted = 0;
    _proto._er = -1;
    _proto._ok = 1;
    _proto.defaults = {
        root: null,
        disconnect: false,
        error: false,
        success: false,
        intersecting: false,
        observing: false,
        successClass: 'b-loaded',
        selector: '.b-lazy',
        errorClass: 'b-error',
        bgClass: 'b-bg',
        rootMargin: '0px',
        threshold: [0]
    };

    // BC for interchanging with bLazy.
    _proto.load = function(elms) {
        var me = this;

        // Manually load elements regardless of being disconnected, or not, relevant
        // for Slick slidesToShow > 1 which rebuilds clones of unloaded elements.
        if (me.isValid(elms)) {
            me.intersecting(elms);
        } else {
            _db.forEach(elms, function(el) {
                if (me.isValid(el)) {
                    me.intersecting(el);
                }
            });
        }

        if (!_disconnected) {
            me.disconnect();
        }
    };

    _proto.isLoaded = function(el) {
        return el.classList.contains(this.options.successClass);
    };

    _proto.isValid = function(el) {
        return typeof el === 'object' && typeof el.length === 'undefined' && !this.isLoaded(el);
    };

    _proto.prepare = function() {
        // Do nothing, let extenders do their jobs.
    };

    _proto.revalidate = function(force) {
        var me = this;

        // Prevents from too many revalidations unless needed.
        if ((force === true || me.count !== me.counted) && (_revTick < me.counted)) {
            _disconnected = false;
            me.elms = (me.options.root || _doc).querySelectorAll(me.options.selector);
            me.observe();

            _revTick++;
        }
    };

    _proto.intersecting = function(el) {
        var me = this;

        // If not extending/ overriding, at least provide the option.
        if (typeof me.options.intersecting === 'function') {
            me.options.intersecting(el, me.options);
        }

        // Be sure to throttle, or debounce your method when calling this.
        _db.trigger(el, 'bio.intersecting', {
            options: me.options
        });

        me.lazyLoad(el);
        me.counted++;

        if (!_disconnected) {
            me.observer.unobserve(el);
        }
    };

    _proto.lazyLoad = function(el) {
        // Do nothing, let extenders do their own lazy, can be images, AJAX, etc.
    };

    _proto.success = function(el, status, parent) {
        var me = this;

        if (typeof me.options.success === 'function') {
            me.options.success(el, status, parent, me.options);
        }

        if (me.erCounted > 0) {
            me.erCounted--;
        }
    };

    _proto.error = function(el, status, parent) {
        var me = this;

        if (typeof me.options.error === 'function') {
            me.options.error(el, status, parent, me.options);
        }

        me.erCounted++;
    };

    _proto.loaded = function(el, status, parent) {
        var me = this;

        el.classList.add(status === me._ok ? me.options.successClass : me.options.errorClass);
        me[status === me._ok ? 'success' : 'error'](el, status, parent);
    };

    _proto.observe = function() {
        var me = this;

        _bioTick = me.elms.length;
        _db.forEach(me.elms, function(entry) {
            // Only observes if not already loaded.
            if (!me.isLoaded(entry)) {
                me.observer.observe(entry);
            }
        });
    };

    _proto.observing = function(entries, observer) {
        var me = this;

        me.entries = entries;
        // Stop watching if already disconnected.
        if (_disconnected) {
            return;
        }

        // Load each on entering viewport.
        _db.forEach(entries, function(entry) {
            // Provides option such as to animate bg or elements regardless position.
            if (typeof me.options.observing === 'function') {
                me.options.observing(entry, observer, me.options);
            }

            // The element is being intersected.
            if (entry.isIntersecting || entry.intersectionRatio > 0) {
                if (!me.isLoaded(entry.target)) {
                    me.intersecting(entry.target);
                }

                _bioTick--;
            }
        });

        // Disconnect when all is done.
        me.disconnect();
    };

    _proto.disconnect = function(force) {
        var me = this;

        // Do not disconnect if any error found.
        if (me.erCounted > 0 && !force) {
            return;
        }

        // Disconnect when all entries are loaded, if so configured.
        if (((_bioTick === 0 || me.count === me.counted) && me.options.disconnect) || force) {
            me.observer.disconnect();
            me.count = 0;
            me.elms = null;
            _disconnected = true;
        }
    };

    _proto.destroy = function(force) {
        var me = this;
        me.disconnect(force);
        me.observer = null;
    };

    _proto.disconnected = function() {
        return _disconnected;
    };

    _proto.reinit = function() {
        _disconnected = false;
        _observed = false;
        init(this);
    };

    function init(me) {
        var config = {
            rootMargin: me.options.rootMargin,
            threshold: me.options.threshold
        };

        me.elms = (me.options.root || _doc).querySelectorAll(me.options.selector + ':not(.' + me.options.successClass + ')');
        me.count = me.elms.length;
        me.windowWidth = _db.windowWidth();

        me.prepare();

        // Initializes the IO.
        me.observer = new IntersectionObserver(me.observing.bind(me), config);

        // Observes once on the page load regardless multiple observer instances.
        // Possible as we nullify the root option to allow querying the DOM once.
        // Should you need to re-validate, or re-observe, just call ::observe().
        if (!_observed) {
            me.observe();
            _observed = true;
        }
    }

    return Bio;

});;
/**
 * @file
 * Provides Intersection Observer API loader for media.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
 * @see https://developers.google.com/web/updates/2016/04/intersectionobserver
 */

/* global define, module */
(function(root, factory) {

    'use strict';

    // Inspired by https://github.com/addyosmani/memoize.js/blob/master/memoize.js
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([window.dBlazy, window.Bio], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but only CommonJS-like
        // environments that support module.exports, like Node.
        module.exports = factory(window.dBlazy, window.Bio);
    } else {
        // Browser globals (root is window).
        root.BioMedia = factory(window.dBlazy, window.Bio);
    }
})(this, function(dBlazy, Bio) {

    'use strict';

    /**
     * Private variables.
     */
    var _db = dBlazy;
    var _bio = Bio;
    var _src = 'src';
    var _srcSet = 'srcset';
    var _bgSrc = 'data-src';
    var _dataSrc = 'data-src';
    var _dataSrcset = 'data-srcset';
    var _bgSources = [_src];
    var _imgSources = [_srcSet, _src];

    /**
     * Constructor for BioMedia, Blazy IntersectionObserver for media.
     *
     * @param {object} options
     *   The BioMedia options.
     *
     * @return {object}
     *   The BioMedia instance.
     *
     * @namespace
     */
    function BioMedia(options) {
        return _bio.apply(this, arguments);
    }

    // Inherits Bio prototype.
    var _proto = BioMedia.prototype = Object.create(Bio.prototype);
    _proto.constructor = BioMedia;

    _proto.lazyLoad = (function(_bio) {
        return function(el) {
            // Image may take time to load after being hit, and it may be intersected
            // several times till marked loaded. Ensures it is hit once regardless
            // of being loaded, or not. No real issue with normal images on the page,
            // until having VIS alike which may spit out new images on AJAX request.
            if (el.hasAttribute('data-bio-hit')) {
                return;
            }

            var me = this;
            var parent = el.parentNode;
            var isImage = _db.equal(el, 'img');
            var isBg = typeof el.src === 'undefined' && el.classList.contains(me.options.bgClass);
            var isPicture = parent && _db.equal(parent, 'picture');
            var isVideo = _db.equal(el, 'video');

            // PICTURE elements.
            if (isPicture) {
                _db.setAttrsWithSources(el, _srcSet, true);

                // Tiny controller image inside picture element won't get preloaded.
                _db.setAttr(el, _src, true);
                me.loaded(el, me._ok);
            }
            // VIDEO elements.
            else if (isVideo) {
                _db.setAttrsWithSources(el, _src, true);
                el.load();
                me.loaded(el, me._ok);
            } else {
                // IMG or DIV/ block elements got preloaded for better UX with loading.
                if (isImage || isBg) {
                    me.setImage(el, isBg);
                }
                // IFRAME elements, etc.
                else {
                    if (el.getAttribute(_dataSrc) && el.hasAttribute(_src)) {
                        _db.setAttr(el, _src, true);
                        me.loaded(el, me._ok);
                    }
                }
            }

            // Marks it hit/ requested. Not necessarily loaded.
            el.setAttribute('data-bio-hit', 1);

            return _bio.apply(this, arguments);
        };
    })(_proto.lazyLoad);

    _proto.promise = function(el, isBg) {
        var me = this;

        return new Promise(function(resolve, reject) {
            var img = new Image();

            // Preload `img` to have correct event handlers.
            img.src = el.getAttribute(isBg ? _bgSrc : _dataSrc);
            if (el.hasAttribute(_dataSrcset)) {
                img.srcset = el.getAttribute(_dataSrcset);
            }

            // Applies attributes regardless, will re-observe if any error.
            var applyAttrs = function() {
                if (isBg) {
                    me.setBg(el);
                } else {
                    _db.setAttrs(el, _imgSources, false);
                }
            };

            // Handle onload event.
            img.onload = function() {
                applyAttrs();
                resolve(me._ok);
            };

            // Handle onerror event.
            img.onerror = function() {
                applyAttrs();
                reject(me._er);
            };
        });
    };

    _proto.setImage = function(el, isBg) {
        var me = this;

        return me.promise(el, isBg)
            .then(function(status) {
                me.loaded(el, status);
                _db.removeAttrs(el, isBg ? _bgSources : _imgSources);
            })
            .catch(function(status) {
                me.loaded(el, status);

                el.removeAttribute('data-bio-hit');
            })
            .finally(function() {
                // Be sure to throttle, or debounce your method when calling this.
                _db.trigger(el, 'bio.finally', {
                    options: me.options
                });
            });
    };

    _proto.setBg = function(el) {
        if (el.hasAttribute(_bgSrc)) {
            el.style.backgroundImage = 'url("' + el.getAttribute(_bgSrc) + '")';
            el.removeAttribute(_src);
        }
    };

    return BioMedia;

});;