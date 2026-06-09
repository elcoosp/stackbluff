use criterion::{black_box, criterion_group, criterion_main, Criterion};
use sb_game_engine::evaluate::evaluate_hand;
use sb_shared_types::{Card, Rank, Suit};

fn card(suit: Suit, rank: Rank) -> Card {
    Card::new(suit, rank)
}

fn bench_evaluate(c: &mut Criterion) {
    let hole = [card(Suit::Heart, Rank::Number(4)), card(Suit::Club, Rank::Number(8))];
    let community = [
        card(Suit::Diamond, Rank::Number(5)),
        card(Suit::Spade, Rank::Number(6)),
        card(Suit::Heart, Rank::Number(7)),
        card(Suit::Club, Rank::Number(2)),
        card(Suit::Diamond, Rank::Number(Rank::King)),
    ];
    c.bench_function("evaluate_hand", |b| {
        b.iter(|| evaluate_hand(black_box(&hole), black_box(&community)))
    });
}

criterion_group!(benches, bench_evaluate);
criterion_main!(benches);
