import { SubmitResponse } from '../services/api';
export const formatShareText = (result: SubmitResponse): string => {
    return `🃏 Daily Poker Puzzle\n\nI chose: ${result.user_action.toUpperCase()}\nCorrect action: ${result.correct_action.toUpperCase()}\n\n${result.explanation}\n\nCan you beat me? Play here: ${window.location.origin}`;
};
