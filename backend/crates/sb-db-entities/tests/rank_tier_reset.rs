use sb_db_entities::enums::RankTier;

#[test]
fn test_soft_rank_reset_legend_to_maestro() {
    assert_eq!(RankTier::Legend.reset_rank(), RankTier::Maestro);
}

#[test]
fn test_soft_rank_reset_maestro_to_diamond() {
    assert_eq!(RankTier::Maestro.reset_rank(), RankTier::Diamond);
}

#[test]
fn test_soft_rank_reset_diamond_to_platinum() {
    assert_eq!(RankTier::Diamond.reset_rank(), RankTier::Platinum);
}

#[test]
fn test_soft_rank_reset_platinum_to_gold() {
    assert_eq!(RankTier::Platinum.reset_rank(), RankTier::Gold);
}

#[test]
fn test_soft_rank_reset_gold_to_silver() {
    assert_eq!(RankTier::Gold.reset_rank(), RankTier::Silver);
}

#[test]
fn test_soft_rank_reset_silver_floor() {
    assert_eq!(RankTier::Silver.reset_rank(), RankTier::Silver);
}

#[test]
fn test_soft_rank_reset_bronze_floor() {
    assert_eq!(RankTier::Bronze.reset_rank(), RankTier::Bronze);
}

#[test]
fn test_soft_rank_reset_brick_floor() {
    assert_eq!(RankTier::Brick.reset_rank(), RankTier::Brick);
}
