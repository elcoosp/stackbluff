use criterion::{black_box, criterion_group, criterion_main, Criterion};
use sb_game_engine::evaluate::evaluate_hand;
use sb_shared_types::{Card, Rank, Suit};

fn card(suit: Suit, rank: Rank) -> Card { Card { suit, rank } }

fn bench_evaluate(c: &mut Criterion) {
    let hole = [card(Suit::Hearts, Rank::Number(4)), card(Suit::Clubs, Rank::Number(8))];
    let community = [
        card(Suit::Diamonds, Rank::Number(5)), card(Suit::Spades, Rank::Number(6)),
        card(Suit::Hearts, Rank::Number(7)), card(Suit::Clubs, Rank::Number(2)),
        card(Suit::Diamonds, Rank::King),
    ];
    c.bench_function("evaluate_hand", |b| b.iter(|| evaluate_hand(black_box(&hole), black_box(&community))));
}
criterion_group!(benches, bench_evaluate);
criterion_main!(benches);
