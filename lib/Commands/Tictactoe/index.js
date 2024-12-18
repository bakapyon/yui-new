/* eslint-disable max-len */
/* eslint-disable default-case */
/* eslint-disable indent */

/* Requires */
const fs = require('fs');
const path = require('path');
const { Sticker } = require('wa-sticker-formatter');
const tttagent = require('tictactoe-agent');
const Indexer = require('../../index');

/* JSON's | Utilidades */
let envInfo = JSON.parse(fs.readFileSync(`${__dirname}/utils.json`));

/* Define os jogos, apenas em memória, TTT é pra ser jogos rápidos afinal */
const inMemoryGame = {
    score: {},
};

/* Realiza funções de pós finalização */
function postResults(response) {
    /* Verifica se pode resetar a envInfo */
    if (
        envInfo.settings.finish.value === true
        || (envInfo.settings.ender.value === true && envInfo.results.success === false)
    ) {
        /* setTimeout para poder retornar */
        setTimeout(() => {
            /* Reseta a envInfo */
            envInfo.functions.revert.value();

            /* Reseta conforme o tempo */
        }, envInfo.settings.wait.value);
    }

    /* Retorna o resultado de uma função */
    return response;
}

/* Insere o erro na envInfo */
function echoError(error) {
    /* Determina o erro */
    const myError = !(error instanceof Error) ? new Error(`Received a instance of "${typeof error}" in function 'messedup', expected an instance of "Error".`) : error;

    /* Determina o sucesso */
    envInfo.results.success = false;

    /* Determina a falha */
    envInfo.parameters.code.value = myError.code ?? '0';

    /* Determina a mensagem de erro */
    envInfo.parameters.message.value = myError.message ?? 'The operation cannot be completed because an unexpected error occurred.';

    /* Define se pode printar erros */
    if (envInfo.settings.error.value === true) {
        /* Define se vai printar inteiro */
        const showError = config?.fullError?.value || true;

        /* Se pode printar o erro inteiro */
        if (showError) {
            /* Só joga o erro na tela */
            console.error(error);

            /* Se não, formata e printa */
        } else console.log('\x1b[31m', `[${path.basename(__dirname)} #${envInfo.parameters.code.value || 0}] →`, `\x1b[33m${envInfo.parameters.message.value}`);
    }

    /* Retorna o erro */
    return envInfo.results;
}

/* Função que retorna todo o arquivo */
function ambientDetails() {
    /* Retorna a envInfo */
    return envInfo;
}

/* Função para verificar o resultado do jogo em um tabuleiro */
function checkGameResult(board, playerOne, playerTwo) {
    /* Inicializa o resultado como vazio */
    let result = false;

    /* Define as combinações vencedoras por linhas, colunas e diagonais */
    const winCombinations = [
        ['a1', 'a2', 'a3'],
        ['b1', 'b2', 'b3'],
        ['c1', 'c2', 'c3'],
        ['a1', 'b1', 'c1'],
        ['a2', 'b2', 'c2'],
        ['a3', 'b3', 'c3'],
        ['a1', 'b2', 'c3'],
        ['a3', 'b2', 'c1'],
    ];

    /* Verificações por linhas, colunas e diagonais */
    for (let i = 0; i < winCombinations.length; i += 1) {
        /* Define as combinações */
        const [a, b, c] = winCombinations[i];

        /* Baseado na posição */
        if (board[a] === 'X' && board[b] === 'X' && board[c] === 'X') {
            /* Define o jogador 1 como vencedor */
            result = playerOne;

            /* Se o jogador 1 não venceu, verifica o jogador 2 */
        } else if (board[a] === 'O' && board[b] === 'O' && board[c] === 'O') {
            /* Define o jogador 2 como vencedor */
            result = playerTwo;
        }
    }

    /* Verifica empate por meio de todas as jogadas serem feitas */
    if (!result && Object.values(board).every((cell) => cell !== false)) {
        /* Define como Draw */
        result = 'draw';
    }

    /* Se nada acima foi acionado, retorna padrão */
    return result;
}

/* Função de jogo caso a Yui seja a player 2 */
function yuiPlaying(board, chatId, user, difficulty, typePlayer, lvpc) {
    /* Define a jogada */
    let finalStep = '';

    /* Só executa se tiver jogadas */
    if (Object.values(board).includes(false)) {
        /* Baseado na dificuldade, Easy */
        if (difficulty === '1') {
            /* Só aleatoriza */
            finalStep = Indexer('array').extract(Object.keys(board).filter((j) => board[j] === false)).value;
            finalStep = Object.keys(board).indexOf(finalStep);

            /* Medium/Normal/Hardcore */
        } else {
            /* Define o modelo da board */
            const model = new tttagent.Model(Object.values(board).map((d) => d || '-').join(''), typePlayer);

            /* Obtém uma recomendação */
            const recommendation = model.getRecommendation();

            /* Jogada padrão */
            finalStep = recommendation.possibilities.filter((d) => d.index !== recommendation.index).reduce((big, now) => (now.score > big.score ? now : big), { score: -Infinity }).index;

            /* Se lvpc for maior que 50 ou Hardcore */
            if (lvpc > 50 || difficulty === '3') {
                /* Faz a jogada perfeita */
                finalStep = recommendation.index;
            }
        }

        /* Faz a jogada */
        inMemoryGame[chatId][user].board[Object.keys(board)[finalStep]] = typePlayer;

        /* Define como vez do player 1 */
        inMemoryGame[chatId][user].currentStep = inMemoryGame[chatId][user].playerOne;

        /* Define o novo tabuleiro */
        inMemoryGame[chatId][user].board = board;
    }

    /* Retorna algo */
    return board;
}

/* Cria a função de comando */
async function playVelha(
    kill = envInfo.functions.exec.arguments.kill.value,
    env = envInfo.functions.exec.arguments.env.value,
) {
    /* Define um resultado padrão */
    envInfo.results.value = false;

    /* Define o sucesso */
    envInfo.results.success = false;

    /* Try-Catch para casos de erro */
    try {
        /* Se recebeu tudo corretamente, se der ruim, não fará nada */
        if (typeof kill === 'object' && typeof env === 'object') {
            /* Constrói os parâmetros */
            const {
                chatId,
                arks,
                mentionedJidList,
                user,
                userFormated,
                isOwner,
                argl,
                stickerConfig,
                reply,
                lvpc,
            } = env.value;

            /* Define o alias na envInfo */
            envInfo.alias = env.value.alias;

            /* Tira o próprio user da lista de menções e adiciona a BOT */
            const mentionsPlayer = mentionedJidList.filter((d) => d !== user);
            mentionsPlayer.push(yuiNumber);

            /* Menu de ajuda DEV */
            if (arks.includes('--help-dev') && isOwner === true) {
                /* Manda a mensagem de ajuda de dev */
                envInfo.results.value = await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Helper', 'Developer', true, true, envInfo).value }, reply);

                /* Menu de ajuda normal */
            } else if (arks.includes('--help') || argl.length === 0 || !['-play', '-create', '-cancel', '-board', '-placar'].includes(argl[0]) || (argl[0] === '-create' && !/[1-3]/.test(argl[1] || '')) || (argl[0] === '-play' && !/[0-9]/.test(argl[1] || ''))) {
                /* Não inclui informações secretas */
                envInfo.results.value = await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Helper', 'User', true, true, envInfo).value }, reply);

                /* Sistema de TTT */
            } else {
                /* Define um jogo para o grupo */
                inMemoryGame[chatId] = inMemoryGame[chatId] || {};

                /* Localiza o jogo da pessoa */
                let gameCreator = user;
                if (Object.keys(inMemoryGame[chatId]).length > 0) {
                    /* Verifica se algum tem a pessoa */
                    gameCreator = Object.keys(inMemoryGame[chatId]).filter((g) => inMemoryGame[chatId][g].playerOne === user || inMemoryGame[chatId][g].playerTwo === user);

                    /* Se teve algum */
                    if (gameCreator.length !== 0) {
                        /* Verifica novamente se for para jogo especifico */
                        const alterPlayer = gameCreator.filter((d) => mentionsPlayer.includes(d));

                        /* Define o criador do jogo */
                        gameCreator = alterPlayer[0] || gameCreator[0];
                    }
                }

                /* Define o que fazer por nome de comando */
                switch (argl[0]) {
                    /* Envia a tabela */
                    case '-board':
                        /* Verifica se não tem jogos */
                        if (!Object.keys(inMemoryGame[chatId]).includes(gameCreator)) {
                            /* Diz que já pode criar */
                            await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Games', 'Uncreated', true, true, env.value).value }, reply);

                            /* Se tiver */
                        } else {
                            /* Cria o tabuleiro */
                            const canvaBoard = await Indexer('cards').ttt(inMemoryGame[chatId][gameCreator].board);

                            /* Constrói o sticker */
                            const sticker = new Sticker(canvaBoard.value, {
                                ...stickerConfig,
                                type: 'default',
                                quality: 100,
                            });

                            /* Define como formato Baileys */
                            const sendSticker = await sticker.toMessage();

                            /* Envia a board */
                            await kill.sendMessage(chatId, sendSticker, reply);
                        }
                    break;

                    /* Envia o placar */
                    case '-placar':
                        /* Verifica se não tem jogos */
                        if (Object.keys(inMemoryGame.score).length === 0) {
                            /* Diz que já pode criar */
                            await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Games', 'NoPlacar', true, true, env.value).value }, reply);

                            /* Se tiver */
                        } else {
                            /* Cria o placar */
                            const scoreboard = Object.keys(inMemoryGame.score).sort((a, b) => inMemoryGame.score[b].win - inMemoryGame.score[a].win).map((player) => {
                                /* Define o número para marcar */
                                let playerNumber = Indexer('sql').get('personal', player, chatId);
                                playerNumber = playerNumber.value.name.text === 'default' ? player.replace(/@s.whatsapp.net/gi, '') : playerNumber.value.name.text;

                                /* Define os atributos */
                                const { win, lost, draw } = inMemoryGame.score[player];

                                /* Define e retorna a string */
                                return `👤 ${playerNumber}: 🏆 ${win} | 😞 ${lost} | 🤝 ${draw}`;
                            });

                            /* Avisa que apagou */
                            await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Games', 'Placar', true, true, { scoreboard: scoreboard.join('\n\n') }).value }, reply);
                        }
                    break;

                    /* Criar um jogo */
                    case '-create':
                        /* Verifica se a pessoa está em um jogo */
                        if (Object.keys(inMemoryGame[chatId]).includes(gameCreator)) {
                            /* Diz para ela cancelar o jogo antes de iniciar outro */
                            await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Games', 'Created', true, true, env.value).value, mentions: [user, mentionsPlayer[0]] }, reply);

                            /* Se não estiver, prossegue em criar */
                        } else {
                            /* Define o jogo padrão */
                            inMemoryGame[chatId][gameCreator] = {
                                playerOneChar: 'X',
                                playerTwoChar: 'O',
                                playerOneFormatted: false,
                                playerTwoFormatted: false,
                                playerOne: false,
                                playerTwo: false,
                                difficulty: 1,
                                currentStep: 'playerOne',
                                board: {
                                    a1: false,
                                    a2: false,
                                    a3: false,
                                    b1: false,
                                    b2: false,
                                    b3: false,
                                    c1: false,
                                    c2: false,
                                    c3: false,
                                },
                            };
                            inMemoryGame[chatId][gameCreator].playerOne = gameCreator;
                            [inMemoryGame[chatId][gameCreator].playerTwo] = [mentionsPlayer[0]];
                            [inMemoryGame[chatId][gameCreator].difficulty] = [argl[1]];
                            inMemoryGame[chatId][gameCreator].currentStep = gameCreator;
                            inMemoryGame[chatId][gameCreator].playerOneFormatted = gameCreator.replace(/@s.whatsapp.net/gi, '');
                            inMemoryGame[chatId][gameCreator].playerTwoFormatted = mentionsPlayer[0].replace(/@s.whatsapp.net/gi, '');
                            inMemoryGame.score[gameCreator] = {
                                win: 0,
                                lost: 0,
                                draw: 0,
                            };
                            inMemoryGame.score[mentionsPlayer[0]] = {
                                win: 0,
                                lost: 0,
                                draw: 0,
                            };

                            /* Avisa que criou */
                            await kill.sendMessage(chatId, { text: `${Indexer('sql').languages(region, 'Games', 'Init', true, true, { userFormated }).value}\n\n🔢 Moves: 0-9\n\n👤 Player 1: @${userFormated}\n\n👤 Player 2: @${inMemoryGame[chatId][gameCreator].playerTwoFormatted}\n\n🎲 Board:\n\`\`\`+---+---+---+\n| 0 | 3 | 6 |\n+---+---+---+\n| 1 | 4 | 7 |\n+---+---+---+\n| 2 | 5 | 8 |\n+---+---+---+\`\`\``, mentions: [user, mentionsPlayer[0]] }, reply);
                        }
                    break;

                    /* Apagar um jogo */
                    case '-cancel':
                        /* Verifica se não tem jogos */
                        if (!Object.keys(inMemoryGame[chatId]).includes(gameCreator)) {
                            /* Diz que já pode criar */
                            await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Games', 'Uncreated', true, true, env.value).value }, reply);

                            /* Se tiver */
                        } else {
                            /* Deleta */
                            delete inMemoryGame[chatId][gameCreator];

                            /* Avisa que apagou */
                            await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Games', 'Delete', true, true, env.value).value }, reply);
                        }
                    break;

                    /* Fazer uma jogada */
                    case '-play':
                        /* Verifica se não tem jogos */
                        if (!Object.keys(inMemoryGame[chatId]).includes(gameCreator)) {
                            /* Diz que já pode criar */
                            await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Games', 'Uncreated', true, true, env.value).value }, reply);

                            /* Se tiver */
                        } else {
                            /* Define o jogador atual */
                            const actualPlayer = (inMemoryGame[chatId][gameCreator].playerOne === inMemoryGame[chatId][gameCreator].currentStep ? inMemoryGame[chatId][gameCreator].currentStep : inMemoryGame[chatId][gameCreator].playerTwo);
                            const playerFormatted = actualPlayer.replace(/@s.whatsapp.net/gi, '');

                            /* Define o player rival - Uso: Yui */
                            const rivalPlayer = actualPlayer === inMemoryGame[chatId][gameCreator].playerOne ? inMemoryGame[chatId][gameCreator].playerTwo : inMemoryGame[chatId][gameCreator].playerOne;

                            /* Define a index que o player enviou */
                            const playerStep = Object.keys(inMemoryGame[chatId][gameCreator].board)[Number(argl[1])];
                            let availableSteps = Object.keys(inMemoryGame[chatId][gameCreator].board).filter((p) => inMemoryGame[chatId][gameCreator].board[p] === false).map((key) => Object.keys(inMemoryGame[chatId][gameCreator].board).indexOf(key)).join(', ');

                            /* Define o operador do jogador */
                            const playerOperator = inMemoryGame[chatId][gameCreator].playerOne === user ? inMemoryGame[chatId][gameCreator].playerOneChar : inMemoryGame[chatId][gameCreator].playerTwoChar;

                            /* Define o operador rival - Uso: Yui */
                            const rivalOperator = playerOperator === 'X' ? 'O' : 'X';

                            /* Mas não for a vez */
                            if (inMemoryGame[chatId][gameCreator].currentStep !== user) {
                                /* Avisa que não é a vez */
                                await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Games', 'NotTurn', true, true, { playerFormatted }).value, mentions: [inMemoryGame[chatId][gameCreator].playerOne, inMemoryGame[chatId][gameCreator].playerTwo] }, reply);

                                /* Se for a vez, mas a jogada não for válida */
                            } else if (inMemoryGame[chatId][gameCreator].board[playerStep] !== false) {
                                /* Avisa que não é a vez */
                                await kill.sendMessage(chatId, { text: `${Indexer('sql').languages(region, 'Games', 'Invalid', true, true, { movements: availableSteps }).value}\n\n🎲 Board:\n\`\`\`+---+---+---+\n| 0 | 3 | 6 |\n+---+---+---+\n| 1 | 4 | 7 |\n+---+---+---+\n| 2 | 5 | 8 |\n+---+---+---+\`\`\`` }, reply);

                                /* Se a jogada estiver certa */
                            } else {
                                /* Faz ela no board */
                                inMemoryGame[chatId][gameCreator].board[playerStep] = playerOperator;
                                inMemoryGame[chatId][gameCreator].currentStep = rivalPlayer;

                                /* Verifica se venceu */
                                let isVictory = checkGameResult(inMemoryGame[chatId][gameCreator].board, inMemoryGame[chatId][gameCreator].playerOne, inMemoryGame[chatId][gameCreator].playerTwo);

                                /* Se é um jogo contra a Yui */
                                if (rivalPlayer === yuiNumber && isVictory === false) {
                                    /* Executa a jogada da Yui */
                                    yuiPlaying(inMemoryGame[chatId][gameCreator].board, chatId, user, inMemoryGame[chatId][gameCreator].difficulty, rivalOperator, lvpc);
                                }

                                /* Tabuleiro */
                                const canvaBoard = await Indexer('cards').ttt(inMemoryGame[chatId][gameCreator].board);

                                /* Constrói o sticker */
                                const sticker = new Sticker(canvaBoard.value, {
                                    ...stickerConfig,
                                    type: 'default',
                                    quality: 100,
                                });

                                /* Define como formato Baileys */
                                const sendSticker = await sticker.toMessage();

                                /* Envia */
                                await kill.sendMessage(chatId, sendSticker, reply);

                                /* Verifica por vitorias */
                                isVictory = checkGameResult(inMemoryGame[chatId][gameCreator].board, inMemoryGame[chatId][gameCreator].playerOne, inMemoryGame[chatId][gameCreator].playerTwo);

                                /* Se for draw */
                                if (isVictory === 'draw') {
                                    /* Avisa o fim */
                                    await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Games', 'Draw', true, true, { gameend: 'DRAW' }).value, mentions: [inMemoryGame[chatId][gameCreator].playerOne, inMemoryGame[chatId][gameCreator].playerTwo] });

                                    /* Adiciona os pontos */
                                    inMemoryGame.score[inMemoryGame[chatId][gameCreator].playerOne].draw += 1;
                                    inMemoryGame.score[inMemoryGame[chatId][gameCreator].playerTwo].draw += 1;

                                    /* Deleta o jogo */
                                    delete inMemoryGame[chatId][gameCreator];

                                    /* Se for vitoria */
                                } else if (isVictory === inMemoryGame[chatId][gameCreator].playerOne || isVictory === inMemoryGame[chatId][gameCreator].playerTwo) {
                                    /* Formata o jogador vitorioso */
                                    const formattedWinner = isVictory.replace(/@s.whatsapp.net/gi, '');

                                    /* Define quem perdeu */
                                    const looserUser = isVictory === inMemoryGame[chatId][gameCreator].playerOne ? inMemoryGame[chatId][gameCreator].playerTwo : inMemoryGame[chatId][gameCreator].playerOne;

                                    /* Avisa o fim */
                                    await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Games', 'Victory', true, true, { gameend: 'K.O', winner: formattedWinner.replace(/@s.whatsapp.net/gi, ''), looser: rivalPlayer.replace(/@s.whatsapp.net/gi, '') }).value, mentions: [inMemoryGame[chatId][gameCreator].playerOne, inMemoryGame[chatId][gameCreator].playerTwo] });

                                    /* Adiciona os pontos */
                                    inMemoryGame.score[isVictory].win += 1;
                                    inMemoryGame.score[looserUser].lost += 1;

                                    /* Ganha icoins */
                                    Indexer('sql').update('leveling', isVictory, chatId, 'coin', envInfo.parameters.coinsWin.value);

                                    /* Perde icoins */
                                    Indexer('sql').update('leveling', looserUser, chatId, 'coin', envInfo.parameters.coinsLost.value);

                                    /* Deleta o jogo */
                                    delete inMemoryGame[chatId][gameCreator];

                                    /* Se nada, continua */
                                } else {
                                    /* Formata o user para mencionar */
                                    const mentionRival = inMemoryGame[chatId][gameCreator].currentStep.replace(/@s.whatsapp.net/gi, '');

                                    /* Atualiza as jogadas possiveis */
                                    availableSteps = Object.keys(inMemoryGame[chatId][gameCreator].board).filter((p) => inMemoryGame[chatId][gameCreator].board[p] === false).map((key) => Object.keys(inMemoryGame[chatId][gameCreator].board).indexOf(key)).join(', ');

                                    /* Avisa quem deve jogar agora */
                                    await kill.sendMessage(chatId, { text: `${Indexer('sql').languages(region, 'Games', 'Play', true, true, { mentionRival }).value}\n\n🔢 Moves:\n${availableSteps}\n\n🎲 Board:\n\`\`\`+---+---+---+\n| 0 | 3 | 6 |\n+---+---+---+\n| 1 | 4 | 7 |\n+---+---+---+\n| 2 | 5 | 8 |\n+---+---+---+\`\`\``, mentions: [inMemoryGame[chatId][gameCreator].playerOne, inMemoryGame[chatId][gameCreator].playerTwo] });
                                }
                            }
                        }
                    break;
                }
            }
        }

        /* Define o resultado como a board, achei mais útil */
        envInfo.results.value = inMemoryGame;

        /* Define o sucesso */
        envInfo.results.success = true;

        /* Caso de algum erro */
    } catch (error) {
        /* Insere tudo na envInfo */
        echoError(error);

        /* Avisa que deu erro enviando o comando e data atual pro sistema SER */
        await kill.sendMessage(env.value.chatId, {
            text: Indexer('sql').languages(region, 'S.E.R', error, true, true, {
                command: 'TICTACTOE',
                time: (new Date()).toLocaleString(),
            }).value,
        }, env.value.reply);
    }

    /* Retorna os resultados */
    return postResults(envInfo.results);
}

/* Função que reseta tudo */
function resetAmbient(
    changeKey = {},
) {
    /* Reseta a Success */
    envInfo.results.success = false;

    /* Define o valor padrão */
    let exporting = {
        reset: resetAmbient,
    };

    /* Try-Catch para casos de erro */
    try {
        /* Define a envInfo padrão */
        envInfo = JSON.parse(fs.readFileSync(`${__dirname}/utils.json`));

        /* Define se algum valor deve ser salvo */
        if (Object.keys(changeKey).length !== 0) {
            /* Faz a listagem de keys */
            Object.keys(changeKey).forEach((key) => {
                /* Edita se a key existir */
                if (Object.keys(envInfo).includes(key) && key !== 'developer') {
                    /* Edita a key customizada */
                    envInfo[key] = changeKey[key];
                }
            });
        }

        /* Insere a postResults na envInfo */
        envInfo.functions.poswork.value = postResults;

        /* Insere a ambient na envInfo */
        envInfo.functions.ambient.value = ambientDetails;

        /* Insere a error na envInfo */
        envInfo.functions.messedup.value = echoError;

        /* Insere a revert na envInfo */
        envInfo.functions.revert.value = resetAmbient;

        /* Insere a playVelha na envInfo */
        envInfo.functions.exec.value = playVelha;

        /* Define o local completo na envInfo para usar o reload novamente */
        envInfo.parameters.location.value = __filename;

        /* Gera a module exports */
        module.exports = {
            [envInfo.name]: {
                [envInfo.exports.env]: envInfo.functions.ambient.value,
                [envInfo.exports.messedup]: envInfo.functions.messedup.value,
                [envInfo.exports.poswork]: envInfo.functions.poswork.value,
                [envInfo.exports.reset]: envInfo.functions.revert.value,
                [envInfo.exports.exec]: envInfo.functions.exec.value,
            },
            Developer: 'pyon',
            Projects: 'https://github.com/pyon',
        };

        /* Determina sucesso */
        envInfo.results.success = true;

        /* Define o valor retornado */
        exporting = module.exports;

        /* Caso de algum erro */
    } catch (error) {
        /* Insere tudo na envInfo */
        echoError(error);
    }

    /* Retorna o exports */
    return exporting;
}

/* Constrói a envInfo */
resetAmbient();
