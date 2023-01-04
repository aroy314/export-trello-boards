# Export Trello Boards
## Description
This Node.js script will take all your boards from an organization and export them in the same JSON format as you would have by exporting 
manually (trello.com/b/{board_id}.json) BUT will do it **with the Trello API** and not the /b/{board_id}.json path.

## Why ?
The /b/{board_id}.json path is limited to small boards, it gets a 504 timeout for big boards (over 600 cards, 
3500 attachments and 1600 checklists), something that would create a JSON file over 10 Mo. 
So I wrote this script to be able to back up my biggest Trello boards. 

Credits : I used this [node wrapper for Trello API](https://github.com/norberteder/trello)

## How to use
1. Log in to Trello and visit [trello.com/app-key](https://trello.com/app-key) to get a token and app key. Fill the file `config.json` with them. 
2. Fill also the organizationId which is what you have in the URL of your organization dashboard (trello.com/w/{organizationId})
3. Make sure [node.js and npm](https://nodejs.org/) are installed on your computer `node -v && npm -v`. 
This script has been developed with node v16.15.1 and npm 8.13.2
4. Install packages `npm i`
5. Run it `npm run export`
6. Your export will be available in the directory `export/YYYY-MM-DD` with one json file per board

## Changelog
v1.0 - 2023-01-04
- Functional script to fetch all boards of an organization, their lists, cards (with attachments), actions, custom fields, checklists and members

# Feedback
You found a bug? You need a new feature? You can [create an issue](https://github.com/pgrimaud/instagram-user-feed/issues) if needed or contact me on [Twitter](https://twitter.com/pgrimaud_).
