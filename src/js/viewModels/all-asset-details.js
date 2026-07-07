/*
 * src/js/viewModels/all-asset-details.js
 * Renders the asset list with search/filter and injects it into the target container.
 * Oracle Redwood UI — bhm-* design system (aligned with Bulk Metre Reading plugin).
 * Depends on: AssetDetail (asset-detail.js)
 */
"use strict";

var AllAssetDetails = (function () {

    var _state = {}; // filter state per containerId: { filter: 'all'|'pending'|'completed' }

    function render(containerId, data) {
        var container = document.getElementById(containerId);
        if (!container) {
            console.error('[AllAssetDetails] Container not found:', containerId);
            return;
        }

        // data is either an IB Assets array or a legacy problem_code enum object
        var isIbMode = Array.isArray(data);
        container.innerHTML = '';
        _state[containerId] = { filter: 'all' };

        var rowCount = isIbMode ? data.length : Object.keys(data || {}).length;
        if (rowCount === 0) {
            container.innerHTML =
                '<div class="bhm-card"><div class="bhm-empty">' +
                    '<span style="font-size:2rem;opacity:.3">&#128269;</span>' +
                    '<strong>No assets found for this customer.</strong>' +
                '</div></div>';
            return;
        }

        /* ── Topbar: search + filter tabs ── */
        var topbar = document.createElement('div');
        topbar.className = 'bhm-card bhm-topbar';
        topbar.innerHTML =
            '<div class="bhm-topbar-search">' +
                '<div class="field">' +
                    '<label class="lbl" for="bhm-search-' + containerId + '">Search Assets</label>' +
                    '<input type="text" id="bhm-search-' + containerId + '" ' +
                        'placeholder="Asset ID, Serial, Description…" ' +
                        'oninput="AllAssetDetails.applyFilter(\'' + containerId + '\')">' +
                '</div>' +
            '</div>' +
            '<div class="bhm-filter-tabs" id="bhm-tabs-' + containerId + '">' +
                '<button class="bhm-tab bhm-tab-active" ' +
                    'onclick="AllAssetDetails.setFilter(\'' + containerId + '\', \'all\', this)">All</button>' +
                '<button class="bhm-tab" ' +
                    'onclick="AllAssetDetails.setFilter(\'' + containerId + '\', \'pending\', this)">Pending</button>' +
                '<button class="bhm-tab" ' +
                    'onclick="AllAssetDetails.setFilter(\'' + containerId + '\', \'completed\', this)">Completed</button>' +
            '</div>';
        container.appendChild(topbar);

        /* ── List card ── */
        var listCard = document.createElement('div');
        listCard.className = 'bhm-card';

        /* Column header row */
        var colLabel = isIbMode ? 'Asset / Description' : 'Problem Code';
        var hdr = document.createElement('div');
        hdr.className = 'bhm-list-hdr';
        hdr.innerHTML =
            '<span></span>' +
            '<span>' + colLabel + '</span>' +
            '<span>Serial</span>' +
            '<span>Manufacturer</span>' +
            '<span>Model</span>' +
            '<span>Status</span>';
        listCard.appendChild(hdr);

        /* Item rows */
        var listWrap = document.createElement('div');
        listWrap.id = 'bhm-list-' + containerId;

        if (isIbMode) {
            data.forEach(function(asset, idx) {
                var fragment = AssetDetail.createRows(asset, idx);
                if (fragment.nodeType === 11 /* DocumentFragment */) {
                    listWrap.appendChild(fragment);
                } else {
                    listWrap.appendChild(fragment);
                }
            });
        } else {
            Object.keys(data).forEach(function(key, idx) {
                listWrap.appendChild(AssetDetail.createRows(key, data[key], idx));
            });
        }

        listCard.appendChild(listWrap);
        container.appendChild(listCard);

        console.log('[AllAssetDetails] Rendered ' + rowCount + ' row(s) (' + (isIbMode ? 'IB Assets' : 'legacy enum') + ').');
    }

    /* ── applyFilter() — filter rows by search text and active tab ── */
    function applyFilter(containerId) {
        var searchEl = document.getElementById('bhm-search-' + containerId);
        var listWrap = document.getElementById('bhm-list-'   + containerId);
        if (!listWrap) return;

        var query  = searchEl ? searchEl.value.trim().toLowerCase() : '';
        var filter = (_state[containerId] || {}).filter || 'all';

        listWrap.querySelectorAll('.bhm-list-item').forEach(function(row) {
            var ri              = row.id.replace('bhm-row-', '');
            var assetId         = (row.dataset.assetId         || '').toLowerCase();
            var customerAssetId = (row.dataset.customerAssetId || '').toLowerCase();
            var serial          = (row.dataset.serial          || '').toLowerCase();
            var label           = (row.dataset.label           || '').toLowerCase();
            var code            = (row.dataset.code            || '').toLowerCase();
            var detRow  = document.getElementById('bhm-det-' + ri);
            var complEl = detRow ? detRow.querySelector('#bhm-complete-' + ri) : null;
            var complete = complEl ? complEl.checked : false;
            if (!complete && typeof AssetDetail !== 'undefined' && AssetDetail.getSavedStatus) {
                var saved = AssetDetail.getSavedStatus(ri);
                if (saved) complete = saved.complete;
            }

            var matchSearch = !query ||
                assetId.indexOf(query)         !== -1 ||
                customerAssetId.indexOf(query) !== -1 ||
                serial.indexOf(query)          !== -1 ||
                label.indexOf(query)           !== -1 ||
                code.indexOf(query)            !== -1;
            var matchFilter = filter === 'all' ||
                              (filter === 'completed' && complete) ||
                              (filter === 'pending'   && !complete);

            var show = matchSearch && matchFilter;
            row.style.display = show ? '' : 'none';
            if (detRow) detRow.style.display = show ? '' : 'none';
        });
    }

    /* ── setFilter() — activate a filter tab and re-apply ── */
    function setFilter(containerId, filterVal, btn) {
        if (!_state[containerId]) _state[containerId] = {};
        _state[containerId].filter = filterVal;

        var tabsEl = document.getElementById('bhm-tabs-' + containerId);
        if (tabsEl) {
            tabsEl.querySelectorAll('.bhm-tab').forEach(function(t) {
                t.classList.remove('bhm-tab-active');
            });
        }
        if (btn) btn.classList.add('bhm-tab-active');

        applyFilter(containerId);
    }

    return { render: render, applyFilter: applyFilter, setFilter: setFilter };

})();
