/* eslint-disable default-case */
/* eslint-disable indent */
/* eslint-disable max-len */

/* Requires */
const fs = require('fs');
const path = require('path');
const { Sticker } = require('wa-sticker-formatter');
const chess = require('chess.js');
const Indexer = require('../../index');

/* JSON's | Utilidades */
let envInfo = JSON.parse(fs.readFileSync(`${__dirname}/utils.json`));

/* Define os jogos, apenas em memória */
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

/* Função para verificar o jogo atual em um tabuleiro */
async function checkGaming(chessg, kill, chatId, gameCreator, reply, nowPlayer, rivalPlayer) {
    /* Inicializa o resultado como vazio */
    let result = false;

    /* Verifica se o jogo não é nulo */
    if (inMemoryGame[chatId][gameCreator] !== null) {
        /* Define o dialogo e user */
        let dialogue = '';
        const userPlayer = `${nowPlayer}@s.whatsapp.net`;

        /* Verifica diferentes cenários de fim do jogo | Draw */
        if (chessg.isDraw()) {
            /* Define como draw e insere o dialogo dele */
            result = 'draw';

            /* Afogamento */
        } else if (chessg.isStalemate()) {
            /* Define como afogamento (ingles) e insere o dialogo dele */
            result = 'stalemate';

            /* Não tem mais nada a jogar */
        } else if (chessg.isInsufficientMaterial()) {
            /* Define como empate e insere o dialogo dele */
            result = 'nomoreactions';

            /* Xeque Mate */
        } else if (chessg.isCheckmate()) {
            /* Define como checkmate e insere o dialogo dele */
            result = 'checkmate';

            /* Threefold Repetition */
        } else if (chessg.isThreefoldRepetition()) {
            /* Define como check e insere o dialogo dele */
            result = 'threefoldrepetition';

            /* Outros finais de jogo */
        } else if (chessg.isGameOver()) {
            /* Define como gameover e insere o dialogo dele */
            result = 'gameover';
        }

        /* Define qual ponto inserir */
        if (['nomoreactions', 'stalemate', 'draw', 'gameover', 'threefoldrepetition'].includes(result)) {
            /* Adiciona os pontos de empate */
            inMemoryGame.score[inMemoryGame[chatId][gameCreator].playerOne].draw += 1;
            inMemoryGame.score[inMemoryGame[chatId][gameCreator].playerTwo].draw += 1;

            /* Define o dialogo */
            dialogue = Indexer('sql').languages(region, 'Games', 'Draw', true, true, { gameend: result }).value;

            /* Se for vitoria */
        } else if (result !== false) {
            /* Adiciona os pontos */
            inMemoryGame.score[userPlayer].win += 1;
            inMemoryGame.score[rivalPlayer].lost += 1;

            /* Ganha icoins */
            Indexer('sql').update('leveling', userPlayer, chatId, 'coin', envInfo.parameters.coinsWin.value);

            /* Perde icoins */
            Indexer('sql').update('leveling', rivalPlayer, chatId, 'coin', envInfo.parameters.coinsLost.value);

            /* Define o dialogo */
            dialogue = Indexer('sql').languages(region, 'Games', 'Victory', true, true, { gameend: result, winner: userPlayer.replace(/@s.whatsapp.net/gi, ''), looser: rivalPlayer.replace(/@s.whatsapp.net/gi, '') }).value;
        }

        /* Se houve algo a dizer e jogo acabou */
        if (result !== false) {
            /* Envia uma mensagem marcando o jogador */
            await kill.sendMessage(chatId, { text: `${dialogue}\n\n📊 FEN:\n${inMemoryGame[chatId][gameCreator].fen}`, mentions: [inMemoryGame[chatId][gameCreator].playerOne, inMemoryGame[chatId][gameCreator].playerTwo] }, reply);

            /* Reseta ele */
            delete inMemoryGame[chatId][gameCreator];
        }
    }

    /* Se nada acima foi acionado, retorna padrão */
    return result;
}

/* Função de jogo caso a Yui seja a player 2 */
function yuiPlaying(chessg, chatId, user) {
    /* Define os movimentos */
    const cMoves = chessg.moves();

    /* Só executa se tiver jogadas */
    if (cMoves.length > 0) {
        /* Define a jogada como random */
        let finalStep = cMoves;

        /* Define um segundo resultado alternativo */
        let findStep = false;

        /* Procura um xeque-mate */
        findStep = cMoves.filter((h) => h.includes('#'));

        /* Se não tiver, procura por comer peça */
        findStep = findStep[0] != null ? findStep : cMoves.filter((h) => h.includes('x'));

        /* Define qual usar */
        findStep = findStep[0] != null ? findStep : cMoves;

        /* Define a jogada 'perfeita' */
        finalStep = Indexer('array').extract(findStep).value;

        /* Faz a jogada */
        chessg.move(finalStep);

        /* Define como vez do player 1 */
        inMemoryGame[chatId][user].currentStep = inMemoryGame[chatId][user].playerOne;

        /* Define o novo fen */
        inMemoryGame[chatId][user].fen = chessg.fen();
    }

    /* Retorna algo */
    return inMemoryGame[chatId][user].fen;
}

/* Cria a função de comando */
async function chessDogs(
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
            } else if (arks.includes('--help') || argl.length === 0 || !['-play', '-create', '-cancel', '-board', '-placar', '-pgn', '-raw', '-fen', '-moves'].includes(argl[0])) {
                /* Não inclui informações secretas */
                envInfo.results.value = await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Helper', 'User', true, true, envInfo).value }, reply);

                /* Sistema de Chess */
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
                            /* Importa o Chess */
                            const createChess = new chess.Chess(inMemoryGame[chatId][gameCreator].fen);

                            /* Cria o tabuleiro */
                            const canvaBoard = await Indexer('cards').chess(inMemoryGame[chatId][gameCreator].fen);

                            /* Constrói o sticker */
                            const sticker = new Sticker(canvaBoard.value, {
                                ...stickerConfig,
                                type: 'default',
                                quality: 100,
                            });

                            /* Define como formato Baileys */
                            const sendSticker = await sticker.toMessage();

                            /* Avisa que apagou */
                            await kill.sendMessage(chatId, sendSticker, reply);
                            await kill.sendMessage(chatId, { image: { url: `${__dirname}/chess.png` }, caption: `🔢 Moves: ${createChess.moves().join(', ')}\n\n📊 FEN:\n${inMemoryGame[chatId][gameCreator].fen}` }, reply);
                        }
                    break;

                    /* Define o envio do FEN apenas, copiar e colar */
                    case '-fen':
                        /* Verifica se não tem jogos */
                        if (!Object.keys(inMemoryGame[chatId]).includes(gameCreator)) {
                            /* Diz que já pode criar */
                            await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Games', 'Uncreated', true, true, env.value).value }, reply);

                            /* Se tiver, envia somente o FEN */
                        } else await kill.sendMessage(chatId, { text: inMemoryGame[chatId][gameCreator].fen }, reply);
                    break;

                    /* Define o envio do PGN apenas, copiar e colar, não é usado na Yui, mas em muitos apps */
                    case '-pgn':
                        /* Verifica se não tem jogos */
                        if (!Object.keys(inMemoryGame[chatId]).includes(gameCreator)) {
                            /* Diz que já pode criar */
                            await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Games', 'Uncreated', true, true, env.value).value }, reply);

                            /* Se tiver */
                        } else {
                            /* Importa o Chess */
                            const createChess = new chess.Chess(inMemoryGame[chatId][gameCreator].fen);

                            /* Envia somente o PGN */
                            await kill.sendMessage(chatId, { text: createChess.pgn() }, reply);
                        }
                    break;

                    /* Define o envio do tabuleiro como formato RAW (ASCII) */
                    case '-raw':
                        /* Verifica se não tem jogos */
                        if (!Object.keys(inMemoryGame[chatId]).includes(gameCreator)) {
                            /* Diz que já pode criar */
                            await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Games', 'Uncreated', true, true, env.value).value }, reply);

                            /* Se tiver */
                        } else {
                            /* Importa o Chess */
                            const createChess = new chess.Chess(inMemoryGame[chatId][gameCreator].fen);

                            /* Envia somente o PGN */
                            await kill.sendMessage(chatId, { text: `\`\`\`${createChess.ascii()}\`\`\`` }, reply);
                        }
                    break;

                    /* Define o envio do moves apenas */
                    case '-moves':
                        /* Verifica se não tem jogos */
                        if (!Object.keys(inMemoryGame[chatId]).includes(gameCreator)) {
                            /* Diz que já pode criar */
                            await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Games', 'Uncreated', true, true, env.value).value }, reply);

                            /* Se tiver */
                        } else {
                            /* Importa o Chess */
                            const createChess = new chess.Chess(inMemoryGame[chatId][gameCreator].fen);

                            /* Envia somente o moves */
                            await kill.sendMessage(chatId, { text: createChess.moves().join(', ') }, reply);
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
                            /* Cria o novo Chess */
                            const createChess = new chess.Chess();

                            /* Define o jogo padrão */
                            inMemoryGame[chatId][gameCreator] = {
                                playerOneFormatted: false,
                                playerTwoFormatted: false,
                                playerOne: false,
                                playerTwo: false,
                                currentStep: 'playerOne',
                                fen: createChess.fen(),
                            };
                            inMemoryGame[chatId][gameCreator].playerOne = gameCreator;
                            [inMemoryGame[chatId][gameCreator].playerTwo] = [mentionsPlayer[0]];
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
                            await kill.sendMessage(chatId, { image: { url: `${__dirname}/chess.png` }, caption: `${Indexer('sql').languages(region, 'Games', 'Init', true, true, { userFormated }).value}\n\n🔢 Moves: ${createChess.moves().join(', ')}\n\n👤 Player 1: @${userFormated}\n\n👤 Player 2: @${inMemoryGame[chatId][gameCreator].playerTwoFormatted}\n\n📊 FEN:\n${inMemoryGame[chatId][gameCreator].fen}`, mentions: [user, mentionsPlayer[0]] }, reply);
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
                            /* Cria o novo Chess */
                            const chessGame = new chess.Chess(inMemoryGame[chatId][gameCreator].fen);

                            /* Define o jogador atual */
                            const actualPlayer = (inMemoryGame[chatId][gameCreator].playerOne === inMemoryGame[chatId][gameCreator].currentStep ? inMemoryGame[chatId][gameCreator].currentStep : inMemoryGame[chatId][gameCreator].playerTwo);
                            const playerFormatted = actualPlayer.replace(/@s.whatsapp.net/gi, '');

                            /* Define o player rival - Uso: Yui */
                            const rivalPlayer = actualPlayer === inMemoryGame[chatId][gameCreator].playerOne ? inMemoryGame[chatId][gameCreator].playerTwo : inMemoryGame[chatId][gameCreator].playerOne;

                            /* Define a index que o player enviou */
                            const availableSteps = chessGame.moves();
                            let playerStep = availableSteps.map((d) => d.toLowerCase()).includes(argl[1]);

                            /* Mas não for a vez */
                            if (inMemoryGame[chatId][gameCreator].currentStep !== user) {
                                /* Avisa que não é a vez */
                                await kill.sendMessage(chatId, { text: Indexer('sql').languages(region, 'Games', 'NotTurn', true, true, { playerFormatted }).value, mentions: [inMemoryGame[chatId][gameCreator].playerOne, inMemoryGame[chatId][gameCreator].playerTwo] }, reply);

                                /* Se for a vez, mas a jogada não for válida */
                            } else if (playerStep === false) {
                                /* Envia que a jogada é invalida e fornece ajuda */
                                await kill.sendMessage(chatId, { image: { url: `${__dirname}/chess.png` }, caption: Indexer('sql').languages(region, 'Games', 'Invalid', true, true, { movements: chessGame.moves().join(', ') }).value }, reply);

                                /* Se a jogada estiver certa */
                            } else {
                                /* Ajusta o jogo */
                                playerStep = playerStep ? availableSteps.filter((d) => d.toLowerCase() === argl[1])[0] : playerStep;

                                /* Define como a vez do jogador rival */
                                inMemoryGame[chatId][gameCreator].currentStep = rivalPlayer;

                                /* Faz a jogada */
                                chessGame.move(playerStep);

                                /* Se é um jogo contra a Yui */
                                if (rivalPlayer === yuiNumber) {
                                    /* Executa a jogada da Yui */
                                    yuiPlaying(chessGame, chatId, gameCreator);
                                }

                                /* Atualiza a FEN */
                                inMemoryGame[chatId][gameCreator].fen = chessGame.fen();

                                /* Tabuleiro */
                                const canvaBoard = await Indexer('cards').chess(inMemoryGame[chatId][gameCreator].fen);

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

                                /* Verifica se venceu */
                                const isVictory = await checkGaming(chessGame, kill, chatId, gameCreator, reply, playerFormatted, rivalPlayer);

                                /* Se for draw */
                                if (isVictory === false) {
                                    /* Formata o user para mencionar */
                                    const mentionRival = inMemoryGame[chatId][gameCreator].currentStep.replace(/@s.whatsapp.net/gi, '');

                                    /* Avisa quem deve jogar agora */
                                    await kill.sendMessage(chatId, { text: `${Indexer('sql').languages(region, 'Games', 'Play', true, true, { mentionRival }).value}\n\n🔢 Moves:\n${chessGame.moves().join(', ')}\n\n📊 FEN:\n${inMemoryGame[chatId][gameCreator].fen}\n\n🎲 Board:\n\`\`\`${chessGame.ascii()}\`\`\``, mentions: [inMemoryGame[chatId][gameCreator].currentStep] });
                                }
                            }
                        }
                    break;
                }
            }
        }

        /* Define o resultado como a board, achei mais útil */
        envInfo.results.value = inMemoryGame;

        /* Define o sucesso, se seu comando der erro isso jamais será chamado, então o success automaticamente será false em falhas */
        envInfo.results.success = true;

        /* Caso de algum erro */
    } catch (error) {
        /* Insere tudo na envInfo */
        echoError(error);

        /* Avisa que deu erro enviando o comando e data atual pro sistema S.E.R (Send/Special Error Report) */
        await kill.sendMessage(env.value.chatId, {
            text: Indexer('sql').languages(region, 'S.E.R', error, true, true, {
                command: 'CHESS',
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

        /* Insere a chessDogs na envInfo */
        envInfo.functions.exec.value = chessDogs;

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
