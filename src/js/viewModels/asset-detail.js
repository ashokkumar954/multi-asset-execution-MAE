/*
 * src/js/viewModels/asset-detail.js
 *
 * Builds a summary row + expandable detail panel per asset.
 * Oracle Redwood UI — bhm-* design system.
 *
 *  BAT- codes:   2 reading inputs (Low VDC, High VDC) + Components section
 *  non-BAT codes: 3 reading inputs (Low VDC, High VDC, Low SG)
 *
 *  Actions: Close (collapse) | Save (persist + toast) | Continue (persist + toast + collapse)
 *
 *  Offline persistence: all form data is saved to localStorage on Save/Continue
 *  and restored automatically when a row is re-opened.
 *  Storage key: mae_record_<activityId>_<codeIndex>
 */
"use strict";

var AssetDetail = (function () {

    /* ── Component lists ── */
    var COMP_BAT = ['Cables','Connectors','Contact Tips','Shrouds','Vent Caps','Watering System','Battery Tray','Physical damage'];
    var COMP_OTH = ['Cables','Connectors','Contact Tips','Shrouds','Watering System','Battery Tray','Physical damage'];

    /* ── Component condition options ── */
    var COMP_OPT_HTML =
        '<option value="1">1 - Good Condition</option>' +
        '<option value="2">2 - Address Customer Request</option>' +
        '<option value="3">3 - Safety Related Issue</option>' +
        '<option value="4">4 - Does not meet design Specification</option>' +
        '<option value="5">5 - Missing</option>';

    /* ── Sample data pools (index by hash of codeIndex+codeLabel) ── */
    var _D = {
        ids:   [29148, 30021, 11553, 44821, 76320, 55019, 38741],
        ser:   ['7970CL','PL111222333','BT44921','HK-0012','DK-7731','CL-8820','PL-3310'],
        mfr:   ['DEKA','HAWKER','DEKA','EnerSys','DEKA','HAWKER','EnerSys'],
        mdl:   ['24-G75-19','18-125F-13','24-85-17','36-125-13','48-G75-19','18-100F-11','24-G85-17'],
        dsc:   ['Sit','Stand','Reach','Sit','Counterbalance','Reach','Stand'],
        mfd:   ['01/11','03/15','07/18','11/20','02/19','06/17','09/21'],
        age:   [99,15,82,55,71,43,38],
        dates: ['08/26/2025','09/10/2025','07/15/2025','10/01/2025','08/01/2025','11/05/2025','06/20/2025'],
        hrs:   [54.0,15.0,null,null,12.0,null,null]
    };

    function _buildData(codeIndex, codeLabel) {
        var i       = (codeIndex.length + codeLabel.length) % 7;
        var isBat   = /^BAT-/i.test(codeIndex);
        var isFlood = /flooded|lead/i.test(codeLabel);
        return {
            isBat:    isBat,
            isFlood:  isFlood,
            assetId:  _D.ids[i],   serial:  _D.ser[i],
            mfr:      _D.mfr[i],   model:   _D.mdl[i],
            desc:     _D.dsc[i],   mfgDate: _D.mfd[i],
            age:      _D.age[i],   barcode: '',
            dates:    [_D.dates[i], _D.dates[i], _D.dates[i], _D.dates[i]],
            lcDate:   _D.dates[i],
            totalHrs: _D.hrs[i],
            lowVdc:   isFlood ? '2.222' : '7.7',
            highVdc:  isFlood ? '2.23'  : '6',
            lowSg:    isBat   ? null    : (isFlood ? '1.111' : '1.280')
        };
    }

    function _e(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    /* ═══════════════════════════════════════════════════════════════════════
       Toast
    ═══════════════════════════════════════════════════════════════════════ */

    function _showToast(msg, type) {
        var t = document.getElementById('bhm-toast');
        if (!t) return;
        t.textContent = msg;
        t.className = 'bhm-toast bhm-toast-' + (type || 'ok') + ' show';
        setTimeout(function() { t.classList.remove('show'); }, 2500);
    }

    /* ═══════════════════════════════════════════════════════════════════════
       localStorage helpers
    ═══════════════════════════════════════════════════════════════════════ */

    function _storageKey(codeIndex) {
        var aid = (typeof window.__activityId !== 'undefined' && window.__activityId)
            ? window.__activityId : 'local';
        return 'mae_record_' + aid + '_' + codeIndex;
    }

    function _saveRecord(ri) {
        var sumRow = document.getElementById('bhm-row-' + ri);
        if (!sumRow) return;
        var codeIndex = sumRow.dataset.code || String(ri);
        var record = _collectRecord(ri);
        try {
            localStorage.setItem(_storageKey(codeIndex), JSON.stringify(record));
        } catch (e) {
            console.warn('[AssetDetail] localStorage save failed:', e);
        }
        _refreshSummaryStatus(ri);
    }

    function _restoreRecord(ri) {
        var sumRow = document.getElementById('bhm-row-' + ri);
        if (!sumRow) return;
        var codeIndex = sumRow.dataset.code || String(ri);
        var raw;
        try { raw = localStorage.getItem(_storageKey(codeIndex)); } catch (e) { return; }
        if (!raw) return;
        var rec;
        try { rec = JSON.parse(raw); } catch (e) { return; }

        var det = document.getElementById('bhm-det-' + ri);
        if (!det) return;

        if (rec.checklist) {
            det.querySelectorAll('.bhm-chkl-input').forEach(function(cb) {
                var lbl = cb.nextElementSibling ? cb.nextElementSibling.textContent.trim() : '';
                if (lbl && rec.checklist[lbl] !== undefined) cb.checked = rec.checklist[lbl];
            });
        }

        if (rec.components) {
            det.querySelectorAll('.bhm-comp-sel').forEach(function(sel) {
                var lbl = sel.previousElementSibling ? sel.previousElementSibling.textContent.trim() : '';
                if (lbl && rec.components[lbl] !== undefined) sel.value = rec.components[lbl];
            });
        }

        if (rec.readings) {
            det.querySelectorAll('.bhm-rd-input').forEach(function(inp) {
                var lbl = inp.dataset.label || inp.id;
                if (rec.readings[lbl] !== undefined) inp.value = rec.readings[lbl];
            });
        }

        var note = document.getElementById('bhm-note-' + ri);
        if (note && rec.note !== undefined) note.value = rec.note;

        var repair = document.getElementById('bhm-repair-' + ri);
        if (repair && rec.needsRepair !== undefined) repair.checked = rec.needsRepair;

        var complete = document.getElementById('bhm-complete-' + ri);
        if (complete && rec.complete !== undefined) complete.checked = rec.complete;
    }

    function _refreshSummaryStatus(ri) {
        var badge = document.getElementById('bhm-status-' + ri);
        if (!badge) return;
        var sumRow = document.getElementById('bhm-row-' + ri);
        var codeIndex = sumRow ? (sumRow.dataset.code || String(ri)) : String(ri);
        var raw, rec = null;
        try {
            raw = localStorage.getItem(_storageKey(codeIndex));
            if (raw) rec = JSON.parse(raw);
        } catch (e) {}

        if (!rec) {
            badge.className = 'spill spill-pend';
            badge.textContent = 'Pending';
            return;
        }
        if (rec.complete) {
            badge.className = 'spill spill-done';
            badge.textContent = '✓ Complete';
        } else {
            badge.className = 'spill spill-pend';
            badge.textContent = '● Saved';
        }
    }

    /* Public: return saved {complete, needsRepair} for a row — used by AllAssetDetails filter */
    function getSavedStatus(ri) {
        var sumRow = document.getElementById('bhm-row-' + ri);
        if (!sumRow) return null;
        var codeIndex = sumRow.dataset.code || String(ri);
        var raw;
        try { raw = localStorage.getItem(_storageKey(codeIndex)); } catch (e) { return null; }
        if (!raw) return null;
        try {
            var rec = JSON.parse(raw);
            return { complete: !!rec.complete, needsRepair: !!rec.needsRepair };
        } catch (e) { return null; }
    }

    /* ═══════════════════════════════════════════════════════════════════════
       createRows() — public entry point
       Signatures:
         createRows(asset, rowIndex)            — IB Asset object from Fusion API
         createRows(codeIndex, codeLabel, rowIndex) — legacy problem_code enum
       Returns DocumentFragment with [summary div] + [detail div]
    ═══════════════════════════════════════════════════════════════════════ */
    function createRows(codeIndexOrAsset, codeLabelOrRowIndex, rowIndex) {
        var d, codeIndex, codeLabel, ri;

        if (typeof codeIndexOrAsset === 'object' && codeIndexOrAsset !== null) {
            // ── IB Asset mode ──
            var asset = codeIndexOrAsset;
            ri        = codeLabelOrRowIndex;
            codeIndex = String(asset.instanceNumber || asset.assetId || ri);
            codeLabel = (asset.description || asset.desc || '') + ' (' + (asset.assetId || '') + ')';
            d = {
                isBat:           asset.isBat,
                isFlood:         asset.isFlood,
                assetId:         asset.assetId         || '',
                customerAssetId: asset.customerAssetId || '',
                serial:          asset.serial          || '',
                mfr:             asset.mfr             || '',
                model:           asset.model           || '',
                desc:            asset.desc            || '',
                description:     asset.description     || '',
                mfgDate:         asset.mfgDate         || '',
                age:      '',
                barcode:  asset.barcode  || '',
                dates:    ['—', '—', '—', '—'],
                lcDate:   '—',
                totalHrs: null,
                lowVdc:   asset.isFlood ? '2.222' : '7.7',
                highVdc:  asset.isFlood ? '2.23'  : '6',
                lowSg:    asset.isBat   ? null     : (asset.isFlood ? '1.111' : '1.280')
            };
        } else {
            // ── Legacy problem_code enum mode ──
            codeIndex = codeIndexOrAsset;
            codeLabel = codeLabelOrRowIndex;
            ri        = rowIndex;
            d         = _buildData(codeIndex, codeLabel);
        }

        var frag = document.createDocumentFragment();

        /* ── Summary row ── */
        var sumRow = document.createElement('div');
        sumRow.id              = 'bhm-row-' + ri;
        sumRow.className       = 'bhm-list-item';
        sumRow.dataset.assetId         = String(d.assetId);
        sumRow.dataset.customerAssetId = d.customerAssetId || '';
        sumRow.dataset.serial          = d.serial;
        sumRow.dataset.label           = codeLabel;
        sumRow.dataset.code            = codeIndex;
        var metaLabel = d.customerAssetId
            ? 'Cust ID: ' + d.customerAssetId + (d.serial ? ' · S/N: ' + d.serial : '')
            : (d.serial ? 'S/N: ' + d.serial : _e(String(d.assetId)));
        sumRow.innerHTML =
            '<button class="bhm-exp-btn" id="bhm-ebtn-' + ri + '" ' +
                'onclick="AssetDetail.toggle(' + ri + ')">&#x25B6;</button>' +
            '<div class="bhm-item-main">' +
                '<div class="bhm-item-name">' + _e(codeLabel) + '</div>' +
                '<div class="bhm-item-id">' + _e(metaLabel) + '</div>' +
            '</div>' +
            '<div class="bhm-item-serial">' + _e(d.serial) + '</div>' +
            '<div class="bhm-item-mfr">' + _e(d.mfr) + '</div>' +
            '<div class="bhm-item-model">' + _e(d.model) + '</div>' +
            '<span class="spill spill-pend" id="bhm-status-' + ri + '">Pending</span>';
        frag.appendChild(sumRow);

        /* ── Detail panel ── */
        var detRow = document.createElement('div');
        detRow.id        = 'bhm-det-' + ri;
        detRow.className = 'bhm-detail-panel';
        detRow.innerHTML = _buildPanel(d, codeLabel, codeIndex, ri);
        frag.appendChild(detRow);

        setTimeout(function () { _refreshSummaryStatus(ri); }, 0);

        return frag;
    }

    /* ═══════════════════════════════════════════════════════════════════════
       _buildPanel() — HTML for the expanded card
    ═══════════════════════════════════════════════════════════════════════ */
    function _buildPanel(d, label, code, ri) {
        var isBat = d.isBat;
        var comps = isBat ? COMP_BAT : COMP_OTH;

        /* ── Last Completed chips — skip placeholder '—' dates ── */
        var realDates = d.dates.filter(function(dt) { return dt && dt !== '—'; });
        var lcHTML = realDates.map(function(dt) {
            return '<span class="bhm-lc-chip">' + dt + '</span>';
        }).join('');
        if (isBat && realDates.length > 0) lcHTML += '<span class="bhm-lc-chip na">N/A</span>';
        if (!lcHTML) lcHTML = '<span class="bhm-lc-chip na">No history</span>';

        /* ── Checklist (with oninput to auto-populate note) ── */
        var chkItems = ['Visual Inspection', 'Added Water', 'BDR Download', 'Wash'];
        if (isBat) chkItems.push('ICC Torque');
        var chkHTML = chkItems.map(function(l, j) {
            return '<div class="bhm-chk-item">' +
                '<input type="checkbox" class="bhm-chk-input bhm-chkl-input" id="bhm-chkl-' + ri + '-' + j + '" ' +
                    'oninput="AssetDetail.updateNote(' + ri + ')"/>' +
                '<span>' + l + '</span>' +
            '</div>';
        }).join('');

        /* ── Reading inputs ──
             BAT-:     Low VDC + High VDC (2 inputs)
             non-BAT:  Low VDC + High VDC + Low SG (3 inputs)            */
        var rdHTML =
            '<div class="bhm-rd-col">' +
                '<div class="bhm-rd-lbl">Low VDC</div>' +
                '<input type="text" class="bhm-rd-input" id="bhm-rd-lowvdc-' + ri + '" data-label="Low VDC" ' +
                    'value="' + _e(String(d.lowVdc)) + '" oninput="AssetDetail.updateNote(' + ri + ')"/>' +
            '</div>' +
            '<div class="bhm-rd-col">' +
                '<div class="bhm-rd-lbl">High VDC</div>' +
                '<input type="text" class="bhm-rd-input" id="bhm-rd-highvdc-' + ri + '" data-label="High VDC" ' +
                    'value="' + _e(String(d.highVdc)) + '" oninput="AssetDetail.updateNote(' + ri + ')"/>' +
            '</div>';
        if (!isBat) {
            rdHTML +=
                '<div class="bhm-rd-col">' +
                    '<div class="bhm-rd-lbl">Low SG</div>' +
                    '<input type="text" class="bhm-rd-input" id="bhm-rd-lowsg-' + ri + '" data-label="Low SG" ' +
                        'value="' + _e(String(d.lowSg || '')) + '" oninput="AssetDetail.updateNote(' + ri + ')"/>' +
                '</div>';
        }

        /* ── Component rows (with oninput) ── */
        var compHTML = comps.map(function(c, k) {
            return '<div class="bhm-comp-row">' +
                '<span>' + c + '</span>' +
                '<select class="bhm-comp-sel" id="bhm-comp-' + ri + '-' + k + '" ' +
                    'oninput="AssetDetail.updateNote(' + ri + ')">' +
                    COMP_OPT_HTML +
                '</select>' +
            '</div>';
        }).join('');

        return (
            /* TOP hazard stripe */
            '<div class="bhm-hazard"></div>' +

            /* Action bar: label + Close | Save | Continue */
            '<div class="bhm-action-bar" id="bhm-sub-' + ri + '">' +
                '<span class="bhm-action-label">' + _e(code) + ' &mdash; ' + _e(label) + '</span>' +
                '<div class="bhm-action-btns">' +
                    '<button class="btn-cancel btn-sm" onclick="AssetDetail.closeRow('    + ri + ')">&#10005; Close</button>' +
                    '<button class="btn-submit btn-sm" onclick="AssetDetail.saveRow('     + ri + ')">&#10003; Save</button>' +
                    '<button class="btn-submit btn-sm" onclick="AssetDetail.continueRow(' + ri + ')">&#8594; Continue</button>' +
                '</div>' +
            '</div>' +

            /* Card body — 4 sections */
            '<div class="bhm-card-body">' +

                /* ─ SEC 1: Asset Info ─────────────────────────────────── */
                '<div class="bhm-sec-asset">' +
                    '<div class="bhm-fields-grid">' +
                        '<div class="bhm-field"><div class="bhm-f-lbl">Asset ID</div><div class="bhm-f-val bhm-f-val-id">'      + _e(String(d.assetId))        + '</div></div>' +
                        '<div class="bhm-field"><div class="bhm-f-lbl">Customer Asset ID</div><div class="bhm-f-val bhm-f-val-id">' + _e(d.customerAssetId || '—') + '</div></div>' +
                        '<div class="bhm-field"><div class="bhm-f-lbl">Serial / S/N</div><div class="bhm-f-val">'               + _e(d.serial || '—')          + '</div></div>' +
                        '<div class="bhm-field"><div class="bhm-f-lbl">Manufacturer</div><div class="bhm-f-val">'            + _e(d.mfr)     + '</div></div>' +
                        '<div class="bhm-field"><div class="bhm-f-lbl">Model</div><div class="bhm-f-val">'                   + _e(d.model)   + '</div></div>' +
                        '<div class="bhm-field"><div class="bhm-f-lbl">Item #</div><div class="bhm-f-val">'                  + _e(d.desc)    + '</div></div>' +
                        '<div class="bhm-field"><div class="bhm-f-lbl">Description</div><div class="bhm-f-val">'             + _e(d.description || '') + '</div></div>' +
                        '<div class="bhm-field"><div class="bhm-f-lbl">Mfg Date</div><div class="bhm-f-val">'                + _e(d.mfgDate) + '</div></div>' +
                        '<div class="bhm-field"><div class="bhm-f-lbl">Age</div><div class="bhm-f-val">'                     + _e(String(d.age)) + '</div></div>' +
                        '<div class="bhm-field"><div class="bhm-f-lbl">Barcode</div><div class="bhm-f-val">'                 + _e(d.barcode || '') + '</div></div>' +
                    '</div>' +
                    '<div class="bhm-lc-block">' +
                        '<div class="bhm-lc-title">Last Completed</div>' +
                        '<div class="bhm-lc-dates">' + lcHTML + '</div>' +
                        '<div class="bhm-checklist">' + chkHTML + '</div>' +
                    '</div>' +
                '</div>' +

                /* ─ SEC 2: Last Complete + Last Reading ─────────────────── */
                '<div class="bhm-sec-reading">' +
                    '<div class="bhm-lc-box">' +
                        '<div class="bhm-lc-box-lbl">Last<br>Complete</div>' +
                        '<div class="bhm-lc-box-date">' + (d.lcDate && d.lcDate !== '—' ? d.lcDate : 'N/A') + '</div>' +
                        '<div class="bhm-lc-box-pm">PM</div>' +
                    '</div>' +
                    '<div class="bhm-rd-title">Last Reading</div>' +
                    '<div class="bhm-rd-row">' + rdHTML + '</div>' +
                '</div>' +

                /* ─ SEC 3: Components — BAT- codes only ─────────────────── */
                (isBat ?
                    '<div class="bhm-sec-comps">' +
                        '<div class="bhm-sec-title">Components</div>' +
                        compHTML +
                    '</div>'
                : '') +

                /* ─ SEC 4: Problem Note ──────────────────────────────────── */
                '<div class="bhm-sec-note">' +
                    '<div class="bhm-sec-title">Problem Note</div>' +
                    '<textarea class="bhm-note-area" id="bhm-note-' + ri + '" ' +
                        'placeholder="Enter problem note…"></textarea>' +
                    '<div class="bhm-note-chk">' +
                        '<span>Needs Repair</span>' +
                        '<input type="checkbox" class="bhm-chk-input" id="bhm-repair-' + ri + '"/>' +
                    '</div>' +
                    '<div class="bhm-note-chk">' +
                        '<span>Complete</span>' +
                        '<input type="checkbox" class="bhm-chk-input" id="bhm-complete-' + ri + '"/>' +
                    '</div>' +
                '</div>' +

            '</div>'
        );
    }

    /* ── Compact select: show only number in collapsed state, full text when open ── */
    function _initCompactSelects(ri) {
        var det = document.getElementById('bhm-det-' + ri);
        if (!det) return;
        det.querySelectorAll('.bhm-comp-sel').forEach(function(sel) {
            if (sel.dataset.compactInit) return;
            sel.dataset.compactInit = '1';
            var fullTexts = Array.from(sel.options).map(function(o) { return o.text; });
            function compact() {
                Array.from(sel.options).forEach(function(o) { o.text = o.value; });
            }
            function expand() {
                Array.from(sel.options).forEach(function(o, i) { o.text = fullTexts[i]; });
            }
            sel.addEventListener('mousedown', expand);
            sel.addEventListener('change', function() { setTimeout(compact, 0); });
            sel.addEventListener('blur', compact);
            compact();
        });
    }

    /* ═══════════════════════════════════════════════════════════════════════
       toggle() — expand / collapse; restores saved data on open
    ═══════════════════════════════════════════════════════════════════════ */
    function toggle(ri) {
        var det = document.getElementById('bhm-det-'  + ri);
        var sum = document.getElementById('bhm-row-'  + ri);
        var btn = document.getElementById('bhm-ebtn-' + ri);
        if (!det) return;
        var open = det.classList.toggle('bhm-open');
        if (sum) sum.classList.toggle('bhm-row-open', open);
        if (btn) btn.innerHTML = open ? '&#8964;' : '&#x25B6;';
        if (open) {
            _restoreRecord(ri);
            _initCompactSelects(ri);
        }
    }

    /* ═══════════════════════════════════════════════════════════════════════
       _collectRecord() — gather all form values from the expanded panel
    ═══════════════════════════════════════════════════════════════════════ */
    function _collectRecord(ri) {
        var note     = document.getElementById('bhm-note-'     + ri);
        var repair   = document.getElementById('bhm-repair-'   + ri);
        var complete = document.getElementById('bhm-complete-' + ri);
        var det      = document.getElementById('bhm-det-'      + ri);

        var checklist = {};
        if (det) {
            det.querySelectorAll('.bhm-chkl-input').forEach(function(cb) {
                var lbl = cb.nextElementSibling ? cb.nextElementSibling.textContent.trim() : cb.id;
                checklist[lbl] = cb.checked;
            });
        }

        var components = {};
        if (det) {
            det.querySelectorAll('.bhm-comp-sel').forEach(function(sel) {
                var lbl = sel.previousElementSibling ? sel.previousElementSibling.textContent.trim() : sel.id;
                components[lbl] = sel.value;
            });
        }

        var readings = {};
        if (det) {
            det.querySelectorAll('.bhm-rd-input').forEach(function(inp) {
                readings[inp.dataset.label || inp.id] = inp.value;
            });
        }

        return {
            rowIndex:    ri,
            note:        note     ? note.value       : '',
            checklist:   checklist,
            components:  components,
            readings:    readings,
            needsRepair: repair   ? repair.checked   : false,
            complete:    complete ? complete.checked  : false,
            savedAt:     new Date().toISOString()
        };
    }

    /* ═══════════════════════════════════════════════════════════════════════
       updateNote() — auto-populate Problem Note from checked items + readings
       Called via oninput on checkboxes and reading inputs.
       The textarea remains manually editable at any time.
    ═══════════════════════════════════════════════════════════════════════ */
    function updateNote(ri) {
        var note = document.getElementById('bhm-note-' + ri);
        var det  = document.getElementById('bhm-det-'  + ri);
        if (!note || !det) return;

        var lines = [];

        var chkl = [];
        det.querySelectorAll('.bhm-chkl-input').forEach(function(cb) {
            if (cb.checked) {
                var s = cb.nextElementSibling;
                if (s) chkl.push(s.textContent.trim());
            }
        });
        if (chkl.length) lines.push('Checklist: ' + chkl.join(', '));

        var comps = [];
        det.querySelectorAll('.bhm-comp-sel').forEach(function(sel) {
            if (sel.value && sel.value !== '1') {
                var s = sel.previousElementSibling;
                var name = s ? s.textContent.trim() : sel.id;
                var optText = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : sel.value;
                comps.push(name + ': ' + optText);
            }
        });
        if (comps.length) lines.push('Components: ' + comps.join(', '));

        var rdVals = [];
        det.querySelectorAll('.bhm-rd-input').forEach(function(inp) {
            var v = inp.value.trim();
            if (v) rdVals.push((inp.dataset.label || inp.id) + ': ' + v);
        });
        if (rdVals.length) lines.push('Readings: ' + rdVals.join('\n'));

        note.value = lines.join('\n');
    }

    /* ═══════════════════════════════════════════════════════════════════════
       closeRow() — collapse without saving
    ═══════════════════════════════════════════════════════════════════════ */
    function closeRow(ri) {
        toggle(ri);
    }

    /* ═══════════════════════════════════════════════════════════════════════
       saveRow() — persist to localStorage + toast, stay open
    ═══════════════════════════════════════════════════════════════════════ */
    function saveRow(ri) {
        _saveRecord(ri);
        _showToast('Saved!', 'ok');
    }

    /* ═══════════════════════════════════════════════════════════════════════
       continueRow() — persist to localStorage + toast + collapse
    ═══════════════════════════════════════════════════════════════════════ */
    function continueRow(ri) {
        _saveRecord(ri);
        _showToast('Saved!', 'ok');
        setTimeout(function() { toggle(ri); }, 400);
    }

    return {
        createRows:     createRows,
        toggle:         toggle,
        saveRow:        saveRow,
        continueRow:    continueRow,
        closeRow:       closeRow,
        updateNote:     updateNote,
        getSavedStatus: getSavedStatus
    };

})();
