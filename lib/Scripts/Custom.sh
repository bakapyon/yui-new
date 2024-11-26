#!/usr/bin/env bash

# Continua enquanto ele não digitar um comando
while true; do
    read -rp "[Yui] - Digite um comando customizado (ou 'cancel' para encerrar): " customCommand

    # Verifica se o comando é 'cancel' para encerrar o loop
    if [ "$customCommand" == "cancel" ]; then
        printf "[Yui] - Encerrando... Até mais!"
        exit 0
    fi

    # Verifica se o comando não está vazio
    if [ -z "$customCommand" ]; then
        printf "\n[Yui] - Você não forneceu nenhum comando, tente novamente.\n"
    else
        # Executa o comando usando eval
        eval "$customCommand"

        # Sai
        exit 0
    fi
done
