/*
** Oracle Field Service BHM - Bulk Health Metrics plugin
**
** Copyright (c) 2023, Oracle and/or its affiliates.
** Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl/
*/
'use strict';

define(['services/fusion-rest-api-transport', 'constants'], (FusionRestApiTransport, Constants) => {

    const IB_ASSETS_PATH = '/fscmRestApi/resources/11.13.18.05/installedBaseAssets';

    class IbAssetsService {

        /**
         * @param {object} ofscConnector - OfscConnector instance
         * @param {string} [baseUrl]     - Fusion base URL; defaults to Constants.FUSION_BASE_URL (dev fallback)
         */
        constructor(ofscConnector, baseUrl) {
            this._transport = new FusionRestApiTransport(baseUrl || Constants.FUSION_BASE_URL, ofscConnector);
        }

        /**
         * Fetch all IB assets for a customer site using the two-step BMR pattern:
         *   Step A — GET single asset by assetNumber → extract CustomerSiteId
         *   Step B — GET all assets for that CustomerSiteId
         *
         * @param {string} assetNumber - Value of asset_number from OFSC activity
         * @returns {Promise<Array>}   - Array of mapped asset objects
         */
        async getAssetsBySiteAsset(assetNumber) {
            // Step A: resolve CustomerSiteId from the activity's asset
            const assetData = await this._transport.request(
                IB_ASSETS_PATH + '/' + encodeURIComponent(assetNumber),
                FusionRestApiTransport.HTTP_METHOD_GET
            );
            const customerSiteId = assetData && assetData.CustomerSiteId;
            if (!customerSiteId) {
                throw new Error('[IbAssetsService] CustomerSiteId missing from asset response for: ' + assetNumber);
            }
            console.log('[IbAssetsService] CustomerSiteId:', customerSiteId);

            // Step B: fetch all assets for that customer site
            const data = await this._transport.request(
                IB_ASSETS_PATH,
                FusionRestApiTransport.HTTP_METHOD_GET,
                { q: 'CustomerSiteId=' + customerSiteId }
            );
            const items = (data && data.items) ? data.items : [];
            return items.map(item => IbAssetsService._mapItem(item));
        }

        /**
         * Fetch the assetDFF child resource for any assets where customerAssetId is empty.
         * Mutates each asset in place with DFF values for customerAssetId and serial.
         * All requests fire in parallel; individual failures are silently skipped.
         *
         * @param {Array} assets - Array of mapped asset objects (from getAssetsBySiteAsset)
         * @returns {Promise<void>}
         */
        async prefetchDFF(assets) {
            const missing = assets.filter(a => !a.customerAssetId);
            if (!missing.length) return;

            await Promise.all(missing.map(async (asset) => {
                try {
                    const data = await this._transport.request(
                        IB_ASSETS_PATH + '/' + encodeURIComponent(asset.assetId) + '/child/assetDFF',
                        FusionRestApiTransport.HTTP_METHOD_GET
                    );
                    const dff = data && data.items && data.items[0];
                    if (!dff) return;
                    asset.customerAssetId = dff.customerAssetId || '';
                    asset.serial          = dff.serialNumber    || asset.serial || '';
                } catch(e) {
                    console.warn('[IbAssetsService] DFF fetch failed for asset', asset.assetId, e);
                }
            }));
        }

        /**
         * Map a single Fusion installedBaseAssets response item to the BHM asset shape.
         *
         * isBat / isFlood are derived from Description since the IB API does not expose
         * a dedicated battery-type field. Adjust the regex if a type field becomes available.
         *
         * @param {object} item - Raw Fusion API item
         * @returns {object}
         */
        static _mapItem(item) {
            const desc    = item.Description || '';   // "Testing Battery" — used for isBat/isFlood detection
            const isBat   = /battery|bat\b/i.test(desc);
            const isFlood = /flooded|lead.?acid/i.test(desc);
            return {
                instanceNumber:  String(item.AssetId || ''),  // unique key for storage + row id
                assetId:         item.AssetId         || '',  // UI column: Asset ID
                customerAssetId: item.CustomerAssetId || '',  // customer's own asset identifier
                serial:          item.SerialNumber    || '',  // UI column: Serial / S/N
                mfr:             '',
                model:           '',
                desc:            item.ItemNumber      || '',  // Item Number (e.g. "TEST_BATTERY")
                description:     desc,                        // Fusion Description (e.g. "Battery 24V 375AH")
                mfgDate:         '',
                barcode:         '',
                isBat:           isBat,
                isFlood:         isFlood
            };
        }

        /**
         * Format an ISO date string to MM/YY.
         * @param {string|null} isoDate
         * @returns {string}
         */
        static _formatDate(isoDate) {
            if (!isoDate) return '';
            const d = new Date(isoDate);
            if (isNaN(d.getTime())) return '';
            return String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(-2);
        }
    }

    return IbAssetsService;
});
