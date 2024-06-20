const puppeteer = require('puppeteer-extra')
const tough = require('tough-cookie');

// Mitigate Cloudflare's anti-scraper techniques by using this plugin.
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const StealthPlugin_ = StealthPlugin()
console.log(StealthPlugin_.enabledEvasions)
StealthPlugin_.enabledEvasions.delete('sourceurl')
puppeteer.use(StealthPlugin_)

// 
// Extract account tags from the Arkham API response.
// 
// `data` is an object that looks like:
// {
//     arbitrum_one: {
//         address: '0x68a611Ed2791FfFFA54B5D107eB8E567171b3251',
//         chain: 'arbitrum_one',
//         arkhamEntity: {
//             name: '@kohkim',
//             note: '',
//             id: 'kohkim',
//             type: 'individual',
//             service: null,
//             addresses: null,
//             twitter: 'https://twitter.com/kohkim'
//         },
//         arkhamLabel: {
//             name: 'kohkim.eth',
//             address: '0x68a611Ed2791FfFFA54B5D107eB8E567171b3251',
//             chainType: 'evm'
//         },
//         isUserAddress: false,
//         contract: false,
//         populatedTags: [[Object]]
//     },
//     avalanche: { ... },
//     base: { ... },
//     bsc: { ... },
//     ethereum: { ... },
//     flare: { ... },
//     linea: { ... },
//     manta: { ... },
//     optimism: { ... },
//     polygon: { ... }
// }
// 
// 
function extractTags(data) {
    let populatedTags = []
    let arkhamEntity = null
    let predictedEntity = null
    console.log(data)

    // Iterate over all chains and extract tags.
    Object.entries(data).map(([ k, v ]) => {
        if(v.populatedTags) populatedTags.push(...v.populatedTags)
        if(v.arkhamEntity) arkhamEntity = v.arkhamEntity
        if (v.predictedEntity) {
            arkhamEntity = v.predictedEntity
            predictedEntity = v.predictedEntity
        }
    })

    // post-process logging.
    if(populatedTags) {
        console.log('populatedTags', populatedTags.map(x => x.label).join(', '))
    }
    if (arkhamEntity) {
        console.log('arkhamEntity', arkhamEntity.name)
    }

    return { populatedTags, arkhamEntity }
}

// 
// Extracts Arkham tags for an account denoted by `addy`.
// 
async function extractArkhamData({ page, addy }) {
    return new Promise(async (resolve, reject) => {
        const responseListener = async (res) => {
            const isPreflight = res.request().method() === 'OPTIONS';
            if (isPreflight) return
            // Match for this API endpoint: https://api.arkhamintelligence.com/intelligence/address/0xcadC64F9f974f810b68A714E9001Ce4800719b86/all
            if (res.url().includes('https://api.arkhamintelligence.com/intelligence/address/') && res.url().endsWith('/all')) {
                // log url
                console.log(res.url())

                // try read body catch error
                if (res.status() !== 200) {
                    console.log('Error:', res.status())
                    return reject('Error:', res.status())
                }

                const data = await res.json()
                page.off('response', responseListener);
                resolve(extractTags(data))
            }
        }
        page.on('response', responseListener);

        const response = await page.goto(`https://platform.arkhamintelligence.com/explorer/address/${addy}`, { waitUntil: 'domcontentloaded' });

        // Check status code
        if (response.status() !== 200) {
            // Wait rand(0,20) and retry
            await new Promise(resolve => setTimeout(resolve, Math.random() * 20000))
            
            // retry
            const response2 = await page.goto(`https://platform.arkhamintelligence.com/explorer/address/${addy}`, { waitUntil: 'domcontentloaded' });

            if (response2.status() !== 200) {
                console.log('Error:', response.status())
                reject('Error:', response.status())
            }
        }

    })
}

// 
// Extracts a result set from a Dune dashboard page.
// This catches the POST https://app-api.dune.com/v1/graphql request and extracts the data.
// 
async function getDuneDashboardAddys({ page, url }) {
    return new Promise(async (resolve, rej) => {
        const responseListener = async (res) => {
            const isPreflight = res.request().method() === 'OPTIONS';
            if (isPreflight) return

            if (res.url().includes('https://app-api.dune.com/v1/graphql')) {
                // log url
                console.log(res.url())

                const data = await res.json()
                console.log(data)
                const execution = data.data.get_execution
                const execution_succeeded = execution.execution_succeeded
                // const columns = execution.columns
                const rows = execution_succeeded.data
                console.log(rows)
                
                page.off('response', responseListener);
                
                resolve(rows)
            }
        }
        page.on('response', responseListener);

        await page.goto(url, { waitUntil: 'domcontentloaded' });
    })
}

async function run() {
    // Initialize puppeteer
    const width = 1920;
    const height = 1080;

    const browser = await puppeteer.launch({
        // headless: false,
        args: [`--window-size=${width},${height}`],
        window: {
            width,
            height
        }
    })

    const page = await browser.newPage()
    await page.setViewport({ width, height });

    // The way this scraper works is by using Chrome to load the page and then intercepting the network requests.
    // Chrome has a builtin buffer limit of 5mb for network requests. This is not enough for some of the larger result sets from Dune.
    // Here we increase the buffer size to its maximum, 2GB.
    // This prevents the error of "Request content was evicted from inspector cache".
    // See: https://github.com/puppeteer/puppeteer/issues/1599
    await page._client().send("Network.enable", {
        maxResourceBufferSize: 2147483647,
        maxTotalBufferSize: 2147483647,
    });


    const addy = '0x0f1dfef1a40557d279d0de6e49ab306891a638b8'

//     const duneDashboards = `Puffer restakers
// https://dune.com/queries/3413348/5730543

// Renzo
// https://dune.com/queries/3367963/5649933 

// Swell
// https://dune.com/queries/3404983/5715132

// Vector
// https://dune.com/queries/3425885/5752702

// Eigenpie
// https://dune.com/queries/3425351/5751821

// Genesis
// https://dune.com/queries/3416842/5736858 

// Kelp
// https://dune.com/queries/3368811/5651549

// Prime Staked restakers stats
// https://dune.com/queries/3427514/5755909`.split('\n\n').map(x => x.trim().split('\n'))
// console.log(duneDashboards)

//     for(let dashboard of duneDashboards) {
//         console.log(dashboard)
//         // 1. Get all addys from the dashboard.
//         // 2. For each one, get the tags from Arkham
//         // 3. Dump them to a TSV.
//         const addys = await getDuneDashboardAddys({
//             page,
//             url: dashboard[1]
//         })

//         // Write line-by-line to file.
//         const fs = require('fs');
//         const slugify = require('slugify')
//         const fname = slugify(dashboard[0]) + '.tsv'

//         const columns = ['Address', 'Arkham - Entity', 'Arkham - Potential Match', 'Arkham - Twitter', 'Arkham - Tags'].join('\t')
//         fs.appendFileSync(fname, `${columns}\n`)

//         // Scraping guidelines:
//         // - 30s + rand() between each request
//         // - If error, retry after 25s + rand()*30s
//         for(let item of addys.slice(0, 30)) {
//             await new Promise(resolve => setTimeout(resolve, 5100 + Math.random() * 3000))

//             const addy = item.restaker
//             console.log(addy)

//             // write each line to a csv
//             while(true) {
//                 try {
//                     const arkhamData = await extractArkhamData({ page, addy })
//                     const arkhamName = arkhamData.arkhamEntity ? arkhamData.arkhamEntity.name : ''
//                     const arkhamPotentialMatch = arkhamData.predictedEntity ? "AI MATCH" : ''
//                     const arkhamTwitter = arkhamData.arkhamEntity ? arkhamData.arkhamEntity.twitter : ''
//                     const arkhamTags = arkhamData.populatedTags ? arkhamData.populatedTags.map(x => x.label).join(', ') : ''

//                     const line = [addy, arkhamName, arkhamTwitter, arkhamTags].join('\t')
//                     fs.appendFileSync(fname, `${line}\n`)
//                     break

//                 } catch(err) {
//                     const delay = 25000 + Math.random() * 30000
//                     console.log(`retrying in ${delay/1000}s`)
//                     await new Promise(resolve => setTimeout(resolve, delay))
//                     continue
//                 }
//             }
//         }
//     }



    // Write line-by-line to file.
    const fs = require('fs');
    const slugify = require('slugify')
    const fname = slugify('output') + '.tsv'

    const columns = ['Address', 'Arkham - Entity', 'Arkham - Potential Match', 'Arkham - Twitter', 'Arkham - Tags'].join('\t')
    fs.appendFileSync(fname, `${columns}\n`)

    const entries = [
        ['PT Weeth June 27', 'export-tokenholders-for-contract-0xf32e58f92e60f4b0a37a69b95d642a471365eae8.csv'],
        ['PT Weeth Sep 26', 'export-tokenholders-for-contract-0xc8edd52d0502aa8b4d5c77361d4b3d300e8fc81c.csv'],
        ['PT Weeth Dec 26', 'export-tokenholders-for-contract-0x7d372819240d14fb477f17b964f95f33beb4c704.csv'],
        ['PT sUSDe July 25', 'export-tokenholders-for-contract-0x107a2e3cd2bb9a32b9ee2e4d51143149f8367eba.csv'],
        ['PT sUSDe Sep 26', 'export-tokenholders-for-contract-0xd1d7d99764f8a52aff007b7831cc02748b2013b5.csv']
    ]
    for (let [collection, holdersDumpFile] of entries) {
        fs.appendFileSync(fname, `\n${collection}\n`)

        const addys = fs.readFileSync(holdersDumpFile, 'utf8').split('\n').slice(1).map(x => x.split(',')[0].replaceAll('"', ''))

        // Scraping guidelines:
        // - 30s + rand() between each request
        // - If error, retry after 25s + rand()*30s
        for (let addy of addys.slice(0, 60)) {
            await new Promise(resolve => setTimeout(resolve, 5100 + Math.random() * 3000))

            console.log(addy)

            // write each line to a csv
            while (true) {
                try {
                    const arkhamData = await extractArkhamData({ page, addy })
                    const arkhamName = arkhamData.arkhamEntity ? arkhamData.arkhamEntity.name : ''
                    const arkhamPotentialMatch = arkhamData.predictedEntity ? "AI MATCH" : ''
                    const arkhamTwitter = arkhamData.arkhamEntity ? arkhamData.arkhamEntity.twitter : ''
                    const arkhamTags = arkhamData.populatedTags ? arkhamData.populatedTags.map(x => x.label).join(', ') : ''

                    const line = [addy, arkhamName, arkhamTwitter, arkhamTags].join('\t')
                    fs.appendFileSync(fname, `${line}\n`)
                    break

                } catch (err) {
                    const delay = 25000 + Math.random() * 30000
                    console.log(`retrying in ${delay / 1000}s`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                    continue
                }
            }
        }
    }

}

run().catch(console.error)
