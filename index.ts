import axios from "axios";
import * as dotenv from "dotenv";
import { schedule } from "node-cron";

dotenv.config();

const {
  OAUTH_GITHUB,
  OWNER,
  REPO,
  BRANCH,
  FILENAME,
  CRON_SCHEDULE
} = process.env;

interface ICommit {
  parents: string[];
  tree: string;
  message: string;
}

const github = axios.create({
  baseURL: `https://api.github.com/repos/${OWNER}/${REPO}/git/`,
  headers: {
    Authorization: `token ${OAUTH_GITHUB}`
  }
});

const getHeadMaster = async () => {
  const headMaster = await github.get(`refs/heads/${BRANCH}`);
  return headMaster.data;
};

const getCommit = async (commitSha: string) => {
  const selectedCommit = await github.get(`commits/${commitSha}`);
  return selectedCommit.data;
};

const createTree = async (lastCommitSHA: string, content: string) => {
  const tree = {
    base_tree: lastCommitSHA,
    tree: [
      {
        content,
        mode: "100644",
        path: FILENAME
      }
    ]
  };
  const newTree = await github.post(`trees`, tree);
  return newTree.data;
};

const createCommit = async (commitContent: ICommit) => {
  const newCommit = await github.post(`commits`, commitContent);
  return newCommit.data;
};

const push = async (sha: string) => {
  const pushed = await github.patch(`refs/${BRANCH}`, {
    sha
  });
  return pushed.data;
};

// Get content from Pokeapi
const getPokemon = async () => {
  const index = Math.floor(Math.random() * 807) + 1;
  const res = await axios.get(`https://pokeapi.co/api/v2/pokemon/${index}`);
  const {
    name,
    sprites: { front_default }
  } = res.data;
  const content = await github.get(
    `/repos/${OWNER}/${REPO}/contents/${FILENAME}`
  );
  const currentContent = Buffer.from(content.data.content, "base64");
  const picture =
    front_default === null
      ? ""
      : `![${name} picture](${front_default} '${name} picture')`;
  return {
    content: `${picture}<br>${name}<br>${currentContent}`,
    currentPoke: name
  };
};

schedule(
  CRON_SCHEDULE as string,
  async () => {
    const numberOfCommits = Math.floor(Math.random() * 8) + 1;
    for (let index = 0; index <= numberOfCommits; index++) {
      const headMaster = await getHeadMaster();
      const lastCommit = await getCommit(headMaster.object.sha);
      // At this point, you can create any function you want to provide the content for the commit
      const pokemon = await getPokemon();
      const newTree = await createTree(lastCommit.tree.sha, pokemon.content);
      const addedCommit = await createCommit({
        message: `${pokemon.currentPoke} said Hi !`,
        parents: [headMaster.object.sha],
        tree: newTree.sha
      });
      await push(addedCommit.sha);
    }
  },
  {}
);
