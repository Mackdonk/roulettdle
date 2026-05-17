"use client";

import {
  Box,
  Button,
  Card,
  Container,
  Flex,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useCallback, useEffect, useRef, useState, startTransition } from "react";

import { getOrCreatePlayerKey } from "@/lib/playerKey";

import { Analytics } from "@vercel/analytics/react";

const SPIN_DURATION_MS = 800;

type ScoreRow = {
  id: string;
  player_key: string;
  play_date_utc: string;
  score: number;
  display_name: string | null;
  created_at: string;
};

function rowLabel(row: ScoreRow): string {
  const name = row.display_name?.trim();
  if (name) return name;
  return `Player ${row.player_key.slice(0, 8)}`;
}

type LeaderboardPanelProps = {
  leaderboard: ScoreRow[];
  leaderboardLoading: boolean;
  leaderboardError: string | null;
  /** Stretch to parent height (play card height on desktop / square on mobile). */
  fillHeight?: boolean;
};

function LeaderboardPanel({
  leaderboard,
  leaderboardLoading,
  leaderboardError,
  fillHeight = false,
}: LeaderboardPanelProps) {
  return (
    <Card
      w="100%"
      h={fillHeight ? "100%" : undefined}
      miw={0}
      shadow="sm"
      padding="lg"
      radius="md"
      style={{
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        ...(fillHeight
          ? { flex: 1, minHeight: 0 }
          : { minHeight: 320 }),
      }}
    >
      <Stack gap={4}>
        <Title order={2} fz="1.15rem" fw={800} tt="uppercase" c="gold">
          Leaderboard
        </Title>

      </Stack>

      <ScrollArea
        type="auto"
        offsetScrollbars
        mt="md"
        flex={fillHeight ? 1 : undefined}
        style={fillHeight ? { flex: 1, minHeight: 0 } : undefined}
        styles={{
          viewport: { paddingRight: 4 },
        }}
      >
        {leaderboardLoading ? (
          <Flex justify="center" align="center" py="xl">
            <Loader color="white" size="sm" />
          </Flex>
        ) : leaderboardError ? (
          <Text size="sm" c="white">
            {leaderboardError}
          </Text>
        ) : leaderboard.length === 0 ? (
          <Text
            size="sm"
            c="white"
            ta="center"
            py="xl"
            px="sm"
            opacity={0.88}
            lh={1.6}
          >
            No scores yet today.
            <br />
            Be the first.
          </Text>
        ) : (
          <Stack gap="xs">
            {leaderboard.map((row, i) => (
              <Flex
                key={row.id}
                justify="space-between"
                align="center"
                gap="md"
                px="sm"
                py={10}
                wrap="nowrap"
                style={{
                  borderRadius: "var(--mantine-radius-md)",
                  background: "rgba(0, 0, 0, 0.14)",
                }}
              >
                <Flex align="center" gap="sm" miw={0} flex={1}>
                  <Text
                    fw={800}
                    c="gold.3"
                    fz="sm"
                    w={28}
                    ta="center"
                    ff="monospace"
                  >
                    {i + 1}
                  </Text>
                  <Text size="sm" truncate title={rowLabel(row)} c="white">
                    {rowLabel(row)}
                  </Text>
                </Flex>
                <Text
                  fw={700}
                  c="gold.3"
                  fz="sm"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {row.score.toLocaleString()}
                </Text>
              </Flex>
            ))}
          </Stack>
        )}
      </ScrollArea>
    </Card>
  );
}

export default function Home() {
  const [coins, setCoins] = useState(100);
  const [topWinnings, setTopWinnings] = useState(coins);
  const [gameEnded, setGameEnded] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<"W" | "L" | null>(null);
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [leaderboard, setLeaderboard] = useState<ScoreRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const res = await fetch("/api/scores");
      const data: unknown = await res.json();
      if (!res.ok || !data || typeof data !== "object") {
        const msg =
          data &&
            typeof data === "object" &&
            "message" in data &&
            typeof (data as { message: unknown }).message === "string"
            ? (data as { message: string }).message
            : "Could not load leaderboard";
        setLeaderboardError(msg);
        setLeaderboard([]);
        return;
      }
      const o = data as { playDateUtc?: unknown; scores?: unknown };
      setLeaderboard(Array.isArray(o.scores) ? (o.scores as ScoreRow[]) : []);
    } catch {
      setLeaderboardError("Could not load leaderboard");
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    getOrCreatePlayerKey();
  }, []);

  useEffect(() => {
    startTransition(() => {
      void loadLeaderboard();
    });
  }, [loadLeaderboard]);

  const submitScore = useCallback(
    async (score: number) => {
      setSubmissionNotice(null);
      const playerKey = getOrCreatePlayerKey();
      if (!playerKey) return;

      const body = JSON.stringify({
        playerKey,
        score: Math.trunc(score),
        displayName: null,
      });

      try {
        const res = await fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        const data: unknown = await res.json().catch(() => ({}));
        const message =
          data &&
            typeof data === "object" &&
            "message" in data &&
            typeof (data as { message: unknown }).message === "string"
            ? (data as { message: string }).message
            : "Could not save score";

        if (res.ok) {
          await loadLeaderboard();
          return;
        }

        if (res.status === 409) {
          setSubmissionNotice("Already played today.");
        } else {
          setSubmissionNotice(message);
          console.error(message);
        }
      } catch (e) {
        console.error(e);
        setSubmissionNotice("Could not save score");
      }
    },
    [loadLeaderboard],
  );

  function endGame() {
    setGameEnded(true);
  }

  function applySpinResult() {
    const win = Math.random() < 0.5;

    if (win) {
      setCoins((prev) => prev * 2);
      setTopWinnings((prev) => prev * 2);
      setLastResult("W");
    } else {
      setCoins(coins * 0);
      setLastResult("L");
      endGame();
      void submitScore(topWinnings);
    }
  }

  function handleSpinClick() {
    if (coins <= 0 || spinning) return;

    if (spinTimerRef.current) {
      clearTimeout(spinTimerRef.current);
    }

    setSpinning(true);
    setLastResult(null);

    spinTimerRef.current = setTimeout(() => {
      applySpinResult();
      setSpinning(false);
      spinTimerRef.current = null;
    }, SPIN_DURATION_MS);
  }

  return (
    <>
      <main
        className="min-h-screen"
        style={{
          background:
            "linear-gradient(180deg, #061a10 0%, var(--background) 38%, var(--background) 100%)",
        }}
      >
        <Container size="sm" py="xl">
          <Stack align="center" gap="lg" pt="xl">
            <Title
              order={1}
              fz="3.5rem"
              fw={900}
              tt="uppercase"
              c="gold.3"
              style={{ letterSpacing: "0.08em" }}
            >
              Roulettdle
            </Title>

            <Box className="w-full mx-auto relative" style={{ maxWidth: 600 }}>
              <Card
                w="100%"
                maw={600}
                miw={0}
                shadow="sm"
                padding="lg"
                radius="md"
                style={{ aspectRatio: 1, position: "relative" }}
              >
                <Stack h="100%" justify="space-between" align="center">
                  <Text ta="center" fz="2rem" fw={800} c="gold.3">
                    {coins}
                  </Text>

                  <Box
                    className={spinning ? "spin-once" : undefined}
                    mx="auto"
                    style={{
                      width: "7.5rem",
                      height: "7.5rem",
                      borderRadius: "9999px",
                      border: "8px dashed var(--foreground)",
                      opacity: 0.9,
                    }}
                  />

                  <Box ta="center" style={{ minHeight: "2.75rem" }}>
                    {!spinning && lastResult ? (
                      <Text
                        fz="2rem"
                        fw={900}
                        c={lastResult === "W" ? "felt.4" : "red.6"}
                        ta="inherit"
                        component="span"
                      >
                        {lastResult}
                      </Text>
                    ) : null}
                  </Box>

                  <Button
                    size="md"
                    disabled={coins <= 0 || spinning}
                    onClick={handleSpinClick}
                  >
                    {spinning ? "Spinning…" : "Spin"}
                  </Button>
                </Stack>

                <Text
                  ta="right"
                  size="sm"
                  c="gold.3"
                  style={{
                    position: "absolute",
                    bottom: "var(--mantine-spacing-lg)",
                    right: "var(--mantine-spacing-lg)",
                  }}
                >
                  Top winnings: {topWinnings}
                </Text>
              </Card>

              <Box
                className="hidden lg:flex"
                style={{
                  position: "absolute",
                  left: "100%",
                  top: 0,
                  bottom: 0,
                  marginLeft: "var(--mantine-spacing-xl)",
                  width: 340,
                  zIndex: 1,
                  flexDirection: "column",
                }}
              >
                <LeaderboardPanel
                  fillHeight
                  leaderboard={leaderboard}
                  leaderboardLoading={leaderboardLoading}
                  leaderboardError={leaderboardError}
                />
              </Box>
            </Box>

            <Box
              className="lg:hidden w-full mx-auto flex flex-col"
              style={{ maxWidth: 600, aspectRatio: 1 }}
              mt="lg"
            >
              <LeaderboardPanel
                fillHeight
                leaderboard={leaderboard}
                leaderboardLoading={leaderboardLoading}
                leaderboardError={leaderboardError}
              />
            </Box>

            <Text size="xl" c="felt.3" ta="center" opacity={0.92}>
              See the most money you can get
            </Text>
          </Stack>
        </Container>
      </main>
      <Modal
        opened={gameEnded}
        onClose={() => {
          setGameEnded(false);
          setSubmissionNotice(null);
        }}
        title="Game over"
        centered
      >
        <Text>
          You reached{" "}
          <Text component="span" c="gold.3" fw={700} inherit>
            {topWinnings}
          </Text>{" "}
          coins.
        </Text>
        {submissionNotice ? (
          <Text size="sm" c="red.4" mt="xs">
            {submissionNotice}
          </Text>
        ) : null}
        <Box mt="md" style={{ display: "flex", justifyContent: "center" }}>
          <Button
            mt="md"
            onClick={() => {
              setGameEnded(false);
              setSubmissionNotice(null);
            }}
          >
            Ok
          </Button>
        </Box>
      </Modal>
    </>
  );
}
