const Trello = require('trello')
const config = require('./config.json')
const {writeExport} = require('./diskUtils')
const trello = new Trello(config.appKey, config.userToken)
const dev = false

const fetchOrganisationBoards = organizationId => {
	console.log('# Fetching boards for organization "' + organizationId + '" :')

	// get all boards
	const boards = [],
		boardsP = trello.getOrgBoards(organizationId)

	return boardsP
		.then(fetchedBoards => {
			console.log('## ' + fetchedBoards.length + ' boards fetched')

			if (dev && fetchedBoards.length > 1){
				fetchedBoards.splice(1, fetchedBoards.length - 1) //keep only one board during dev
				console.log('## Dev mode, only one board fetched : ', fetchedBoards.map(b => b.name))
			}

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
						console.error('Error when fetching board ' + currentBoard.name, err.toString())
					})
			}, Promise.resolve([]))
				.then(([prevBoard, prevLists, prevCards, prevActions, prevCustomFields, prevChecklists, prevMembers]) => {
					// save stuff for last board
					if (prevBoard) {
						console.log('## Items fetched for "' + prevBoard.name + '" :')
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
					return Promise.resolve()
				})

		})
		.then(() => {
			//get attachments for cards board by board
			console.log('### Fetched attachments for all cards :')
			return boards.reduce((prevBoardP, currentBoard, index) =>
					prevBoardP.then(() => fetchAttachmentsForCards(currentBoard.cards, (index + 1) + '/' + boards.length + ' ' + currentBoard.name + ': '))
				, Promise.resolve()
			)

		})
		.then(() => {
			return writeExport(organizationId, boards) //write to disk
		})
		.catch(err => {
			console.error('Error when getBoards', err.toString())
		})
}

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
				console.log('### ' + boardStatus + 'Fetch attachments for card ' + (index + 1) + '/' + cards.length)
				return trello.getAttachmentsOnCard(currentCard.id)
			} else {
				currentCard.attachments = []
				console.log('### ' + boardStatus + 'Skip  attachments for card ' + (index + 1) + '/' + cards.length)
				index++ //pre-increment for next card
				return Promise.resolve([]) //fake empty array of attachments
			}
		})
			.catch(err => {
				console.error('Error when fetching attachments for card ' + cards[index].name, err.toString())
			})
	}, Promise.resolve([]))
}

// check if config.organizationIds is an array and not empty
if (!Array.isArray(config.organizationIds) || !config.organizationIds.length) {
	console.error('config.organizationIds is not an array or is empty')
	process.exit(1)
}

// fetch all boards for all organizations
// Promise.all(config.organizationIds.map(id => fetchOrganisationBoards(id)))
config.organizationIds.reduce((prevP, currentId) => {
	return prevP.then(() => fetchOrganisationBoards(currentId))
}, Promise.resolve())
	.then(() => {
		console.log('All organizations fetched')
	})
