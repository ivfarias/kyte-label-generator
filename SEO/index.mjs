import fs from 'fs';
import inquirer from 'inquirer';
import OpenAI from 'openai';
import { SingleBar, Presets } from 'cli-progress';
import chalk from 'chalk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || ''
});

puppeteer.use(StealthPlugin());

async function scrapeGoogle(query, limit = 10) {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    try {
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&num=${limit}`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('div#main', { timeout: 60000 });

        const searchResults = await page.evaluate((limit) => {
            // Updated to a more generic selector for Google search results
            return Array.from(document.querySelectorAll('div.g')).slice(0, limit).map(item => {
                const linkElement = item.querySelector('a');
                return {
                    url: linkElement ? new URL(linkElement.href).origin : ''
                };
            });
        }, limit);

        await browser.close();
        return { searchResults };
    } catch (error) {
        console.error(`Error during scraping ${query}: ${error.message}`);
        await browser.close();
        return { searchResults: [] };
    }
}

async function analyzeWithOpenAI(messages) {
    try {
        messages.forEach(message => {
            if (typeof message.content !== 'string') {
                throw new Error(
                    `Invalid content in messages: expected a string, got ${typeof message.content}`
                );
            }
        });

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo-1106",
            messages: messages,
            max_tokens: 1024
        });

        if (response && response.choices && response.choices.length > 0 &&
            response.choices[0].message) {
            const analysisText = response.choices[0].message.content;
            return analysisText.trim();
        } else {
            console.error(chalk.red("Unexpected response structure:"),
                response);
            return "Error: Unexpected response structure.";
        }
    } catch (error) {
        console.error(chalk.red("Error in analyzeWithOpenAI:"), error);
        throw error;
    }
}

async function competitorAnalysis(progressBar) {
    const answers = await inquirer.prompt([{
        type: 'input',
        name: 'keywords',
        message: 'Enter keywords for analysis, separated by commas:',
        filter: (input) => input.split(',').map(keyword => keyword.trim())
    }]);

    let allUrls = [];

    for (const keyword of answers.keywords) {
        progressBar.increment({ status: `Searching for ${keyword}...` });

        const { searchResults } = await scrapeGoogle(keyword, 10);

        if (searchResults.length > 0) {
            searchResults.forEach(result => {
                if (result.url) {
                    try {
                        const urlObj = new URL(result.url);
                        allUrls.push(urlObj.origin);
                    } catch (e) {
                        console.error(chalk.red(`Invalid URL skipped: ${result.url}`));
                    }
                }
            });
        } else {
            console.log(chalk.yellow(`Search for '${keyword}' timed out or encountered an error, skipping...`));
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const urlCounts = allUrls.reduce((acc, url) => {
        acc[url] = (acc[url] || 0) + 1;
        return acc;
    }, {});

    const topUrls = Object.entries(urlCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([url, count]) => ({ url, count }));

    if (topUrls.length === 0) {
        console.log(chalk.yellow('No valid competitor URLs found.'));
    } else {
        const csvContent = topUrls.map(({ url, count }) => `${url},${count}`).join('\n');
        fs.writeFileSync('topCompetitors.csv', csvContent);
        console.log(chalk.green('Top competitor analysis saved to topCompetitors.csv'));
    }

    progressBar.update(100, { status: 'Competitor Analysis Complete' });
}


async function main() {
    const progressBar = new SingleBar({
        format: 'Progress |' + chalk.cyan('{bar}') +
            '| {percentage}% || {status}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    }, Presets.shades_classic);

    const moduleSelection = await inquirer.prompt([{
        type: 'list',
        name: 'module',
        message: 'Select the module you want to use:',
        choices: ['SEO Analysis', 'Competitor Analysis']
    }]);

    progressBar.start(100, 0, {
        status: 'Initializing...'
    });

    if (moduleSelection.module === 'SEO Analysis') {
        const answers = await inquirer.prompt([{
            type: 'input',
            name: 'query',
            message: '👋 I\'m ready to help. What query are we running?',
            validate: input => input !== '' ? true :
                'Please enter a query.'
        },
        {
            type: 'confirm',
            name: 'addPiAIQuestions',
            message: '👋 Do you want to add pi.ai questions?',
            default: false
        },
        {
            type: 'input',
            name: 'piAIQuestions',
            message: '👋 Enter your pi.ai questions, separated by commas:',
            when: (answers) => answers.addPiAIQuestions,
            filter: (input) => input.split(',').map(question =>
                question.trim())
        }
        ]);

        progressBar.update(10, {
            status: 'Input received'
        });
        progressBar.update(15, {
            status: 'Scraping Google...'
        });
        const data = await scrapeGoogle(answers.query, progressBar);
        progressBar.update(40, {
            status: 'Google Scraping Complete'
        });

        let paaText = data.peopleAlsoAsk.map(item =>
            `Q: ${item.question}\nA: ${item.answer}`).join('\n\n');
        let piQuestionsText = answers.piAIQuestions ? answers.piAIQuestions
            .join('\n') : '';

        let openAIPrompt =
            `You'll use ${paaText} as well as ${piQuestionsText} to determine if the competitors are covering that information Google deems relevant for the subject. 
                            You'll then create a list of PROs and CONs, highlighting what they are covering in their content and what they are not.`;

        let structuredData = {
            ProjectName: answers.query,
            PiAIQuestions: answers.piAIQuestions || [],
            PeopleAlsoAsk: data.peopleAlsoAsk,
            Competitors: data.searchResults.map((result, index) => ({
                Name: `Competitor ${index + 1}`,
                Details: result
            }))
        };

        let incrementPerCompetitor = 30 / structuredData.Competitors.length;
        for (let i = 0; i < structuredData.Competitors.length; i++) {
            const competitorText = structuredData.Competitors[i].Details
                .bodyText;
            const messages = [{
                role: "system",
                content: "You are a Search Engine Optimization Specialist."
            },
            {
                role: "user",
                content: openAIPrompt
            },
            {
                role: "assistant",
                content: competitorText
            }
            ];

            progressBar.increment(incrementPerCompetitor, {
                status: `Analyzing Competitor ${i + 1}`
            });

            const analysis = await analyzeWithOpenAI(messages);
            structuredData.Competitors[i].AIAanalysis = analysis;
        }

        fs.writeFileSync('structuredResults.json', JSON.stringify(
            structuredData, null, 2));
        progressBar.update(80, {
            status: 'Results Saved'
        });
        const secondAnalysisPrompt = await inquirer.prompt([{
            type: 'confirm',
            name: 'conductSecondAnalysis',
            message: 'Do you want to conduct a second AI analysis?',
            default: false
        }]);

        if (secondAnalysisPrompt.conductSecondAnalysis) {
            const structuredData = JSON.parse(fs.readFileSync(
                'structuredResults.json', 'utf8'));

            let aiAnalysisText = structuredData.Competitors.map(comp => comp
                .AIAanalysis).join('\n\n');
            let secondAIPrompt =
                `Based on ${paaText} and ${piQuestionsText} as well as the following AI analysis conducted for each Competitor:\n\n${aiAnalysisText}\n\nOutline the content structure for an optimized landing page that'll add more value to users and rank higher on Google.`;

            const messages = [{
                role: "system",
                content: "You are a Content Strategist."
            },
            {
                role: "user",
                content: secondAIPrompt
            }
            ];

            progressBar.update(90, {
                status: 'Conducting Second AI Analysis'
            });
            const secondAnalysis = await analyzeWithOpenAI(messages);
            progressBar.update(100, {
                status: 'Process Complete'
            });
            console.log(chalk.green('Second AI Analysis:'), secondAnalysis);
        }

    } else if (moduleSelection.module === 'Competitor Analysis') {
        await competitorAnalysis(progressBar);
    }

    progressBar.stop();
}

main();