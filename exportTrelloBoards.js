const Trello = require('trello')
const config = require('./config.json')
const {writeExport} = require('./diskUtils')
const trello = new Trello(config.appKey, config.userToken)
const dev = false

// get all boards
const boards = [],
	boardsP = trello.getOrgBoards(config.organizationId)

boardsP
	.then(fetchedBoards => {
		console.log(fetchedBoards.length + ' boards fetched')

		if (dev)
			fetchedBoards.splice(1, fetchedBoards.length - 2) //keep only one board during dev

		return fetchedBoards.reduce((prevP, currentBoard) => {
			return prevP.then(([prevBoard, prevLists, prevCards, prevActions, prevCustomFields, prevChecklists, prevMembers]) => {
				// save previous stuff for board
				if (prevBoard) {
					console.log('Items fetched for "' + prevBoard.name + '" :')
					prevBoard.lists = prevLists
					prevBoard.cards = prevCards
					prevBoard.actions = prevActions
					prevBoard.customFields = prevCustomFields
					prevBoard.checklists = prevChecklists
					prevBoard.members = prevMembers
					console.log('- ' + prevLists.length + ' lists fetched')
					console.log('- ' + prevCards.length + ' cards fetched')
					console.log('- ' + prevActions.length + ' actions fetched')
					console.log('- ' + prevCustomFields.length + ' CF fetched')
					console.log('- ' + prevChecklists.length + ' checklists fetched')
					console.log('- ' + prevMembers.length + ' members fetched')

					// console.log('prevBoard with cards and lists', prevBoard)
					// add board to boards array
					boards.push(prevBoard)
				}

				// fetch new stuff for current board
				return fetchDataForBoard(currentBoard)
			})
				.catch(err => {
					console.log('error when fetching board ' + currentBoard.name, err.toString())
				})
		}, Promise.resolve([]))

	})
	.then(() => {
		//get attachments for cards board by board
		console.log('Fetched attachments for all cards :')
		return boards.reduce((prevBoardP, currentBoard, index) =>
				prevBoardP.then(() => fetchAttachmentsForCards(currentBoard.cards, (index + 1) + '/' + boards.length + ' ' + currentBoard.name + ': '))
			, Promise.resolve()
		)

	})
	.then(() => {
		return writeExport(boards) //write to disk
	})
	.catch(err => {
		console.log('Error when getBoards', err.toString())
	})

const fetchDataForBoard = board => {
	const listsP = trello.getListsOnBoard(board.id),
		cardsP = trello.getCardsOnBoard(board.id),
		actionsP = trello.getActionsOnBoard(board.id),
		customFieldsP = trello.getCustomFieldsOnBoard(board.id),
		checklistsP = trello.makeRequest('get', `/1/boards/${board.id}/checklists`),
		membersP = trello.getBoardMembers(board.id),
		results = []

	//execute promises one by one
	return [Promise.resolve(board), listsP, cardsP, actionsP, customFieldsP, checklistsP, membersP]
		.reduce((previousP, current) =>
			previousP.then(result => {
				results.push(result)
				return current
			}))
		.then(finalResult => {
			results.push(finalResult)
			return results
		})
}

/**
 * Returns chunks of size n.
 * @param {Array<any>} array any array
 * @param {number} n size of chunk
 */
function* chunks(array, n) {
	for (let i = 0; i < array.length; i += n) yield array.slice(i, i + n)
}

//not working, returns errors from trello API
const fetchAttachmentsForCards10by10 = (cards) => {
	// 10 by 10
	const chunksOf10Cards = [...chunks(cards, 10)]
	let chunkIndex = 0
	return chunksOf10Cards.reduce((previous10P, current10) => {
		//treat last batch of 10
		return previous10P.then(previous10 => {
			if (previous10.length) {
				//update each card with its attachment
				//match attachments to cards
				console.log('Fetched attachment for cards ' + (chunkIndex * 10) + '/' + cards.length, previous10)
				previous10.forEach((attachments, index) =>
					cards[(chunkIndex * 10) + index].attachments = attachments
				)
				chunkIndex++
			}

			//request next batch of 10
			// console.log('Fetching attachment for cards ' + current10.map(c => c.id).join(','))
			const urls = current10.map(c => `/cards/${c.id}/attachments`).join(',')
			return trello.makeRequest('get', `/1/batch?urls=${urls}/`)
		})

	}, Promise.resolve([]))
}

const fetchAttachmentsForCards = (cards, boardStatus) => {
	// 1 by 1
	let index = 0
	return cards.reduce((previousP, currentCard) => {
		//treat last card request
		return previousP.then(previousAttachments => {
			//skip if no fetch
			if (previousAttachments && previousAttachments.length) {
				//console.log(boardStatus + 'Fetched attachments for cards ' + (index) + '/' + cards.length + ' : ' + previousAttachments.length)
				//make sure there is no errors like this
				// {
				// 	"name": "UnauthorizedError",
				// 	"message": "unauthorized card permission requested",
				// 	"statusCode": 401
				// }
				const attachmentFiltered = previousAttachments.filter(a => !a.statusCode)
				if (attachmentFiltered.length != previousAttachments.length)
					console.error((previousAttachments.length - attachmentFiltered.length) + 'error(s) occurred during fetch for card ' + cards[index].name)
				//match attachments to cards
				cards[index].attachments = attachmentFiltered
				index++
			}

			//request next attachments if next cards has any
			if (currentCard.badges.attachments) {
				console.log(boardStatus + 'Fetch attachments for card ' + (index + 1) + '/' + cards.length)
				return trello.getAttachmentsOnCard(currentCard.id)
			} else {
				currentCard.attachments = []
				console.log(boardStatus + 'Skip  attachments for card ' + (index + 1) + '/' + cards.length)
				index++ //pre-increment for next card
				return Promise.resolve([]) //fake empty array of attachments
			}
		})
			.catch(err => {
				console.error('error when fetching attachments for card ' + cards[index].name, err.toString())
			})
	}, Promise.resolve([]))
}
