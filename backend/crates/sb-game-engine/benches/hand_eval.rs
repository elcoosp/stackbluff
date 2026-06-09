use criterion::{black_box, criterion_group, criterion_main, Criterion};
use sb_game_engine::evaluate::evaluate_hand;
use sb_shared_types::{Card, Rank, Suit};

fn card(suit: Suit, rank: Rank) -> Card { Card { suit, rank } }

fn bench_evaluate(c: &mut Criterion) {
    let hole = [card(Suit::Hearts, Rank::Four), card(Suit::Clubs, Rank::Eight)];
    let community = [
        card(Suit::Diamonds, Rank::Five), card(Suit::Spades, Rank::Six),
        card(Suit::Hearts, Rank::Seven), card(Suit::Clubs, Rank::Two),
        card(Suit::Diamonds, Rank::King),
    ];
    c.bench_function("evaluate_hand", |b| b.iter(|| evaluate_hand(black_box(&hole), black_box(&community))));
}
criterion_group!(benches, bench_evaluate);
criterion_main!(benches);
