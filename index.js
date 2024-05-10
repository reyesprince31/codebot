/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default (app) => {
  const mainRepoUsername = "reyesprince";
  const mainRepoName = "my_first_repo";
  const forkedRepoUsername = "reyesprince31";

  app.log.info("Yay, the app was loaded!");

  app.on("issues.opened", async (context) => {
    if (context.payload.sender.type === "Bot") {
      app.log.info("Issue opened by a bot, skipping comment creation");
      return;
    }
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    return context.octokit.issues.createComment(issueComment);
  });

  app.on("pull_request.opened", async (context) => {
    const { pull_request, repository } = context.payload;

    console.log(
      `Pull request #${pull_request.number} opened in ${repository.full_name}`
    );

    // Check if the pull request was opened by the bot itself
    console.log("is bot", pull_request.user.login);
    if (pull_request.user.login === "codevbots[bot]") {
      console.log("Pull request opened by the bot, skipping comment");
      return;
    }
    // Check if the pull request is in your forked repository
    if (repository.owner.login === forkedRepoUsername) {
      console.log("Pull request opened in your forked repository");

      // Add a comment to the pull request
      const prComment = {
        owner: repository.owner.login,
        repo: repository.name,
        issue_number: pull_request.number,
        body: "Thanks for opening this pull request! Our CI will now run.",
      };

      console.log("Commenting on the pull request...");
      await context.octokit.issues.createComment(prComment);
      console.log("Comment added to the pull request.");
    } else {
      console.log("Pull request not in your forked repository, skipping");
    }
  });

  app.on("pull_request.closed", async (context) => {
    const { action, pull_request, repository } = context.payload;

    console.log(
      `Pull request #${pull_request.number} in ${repository.full_name} was ${action}`
    );

    // Check if the pull request was merged
    if (action === "closed" && pull_request.merged) {
      console.log("Pull request was merged");

      // Check if the merged pull request was into the 'dev' branch
      if (pull_request.base.ref === "develop") {
        console.log("Merged pull request was into the 'dev' branch");

        // Check if the repository is the forked repository
        if (repository.owner.login === "reyesprince31") {
          console.log("Merged pull request is in the forked repository");

          // Open a new pull request from 'develop' to 'main' in the reyesprince31 repository
          await createPullRequestFromDevelopToMain(context, repository);
        } else {
          console.log(
            "Merged pull request is not in your forked repository, skipping"
          );
        }
      } else {
        console.log(
          "Merged pull request is not from 'dev' to 'main' branch, skipping"
        );
      }
    } else if (action === "closed" && !pull_request.merged) {
      console.log("Pull request was closed without merging");
    }
  });

  app.on("pull_request.synchronize", async (context) => {
    const prComment = {
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      issue_number: context.payload.pull_request.number,
      body: `Thanks for this ${context.payload.pull_request.title}, I will update the local branch`,
    };

    return context.octokit.issues.createComment(prComment);
  });

  async function createPullRequestFromDevelopToMain(context, repository) {
    try {
      console.log("Fetching the latest commit on the 'develop' branch...");

      // Get the latest commit on the 'develop' branch
      const developBranch = await context.octokit.git.getRef({
        owner: repository.owner.login,
        repo: repository.name,
        ref: "heads/develop",
      });
      const developCommitSha = developBranch.data.object.sha;
      console.log(`Latest commit on 'develop' branch: ${developCommitSha}`);

      console.log("Opening a new pull request from 'develop' to 'main'...");

      // Open a new pull request from 'develop' to 'main'
      const newPr = await context.octokit.pulls.create({
        owner: repository.owner.login,
        repo: repository.name,
        head: "develop",
        base: "main",
        title: "Merge 'develop' into 'main'",
        body: "This pull request merges the 'develop' branch into the 'main' branch.",
      });

      // Wait for all CI checks to pass
      await waitForCIChecks(context, repository, newPr.data.number);

      console.log(
        "All CI checks have passed, squash merging the pull request..."
      );

      await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait for 1 minute

      console.log("Squash merging the pull request...");

      // Squash merge the pull request
      await context.octokit.pulls.merge({
        owner: repository.owner.login,
        repo: repository.name,
        pull_number: newPr.data.number,
        merge_method: "squash",
        commit_title: "Merge 'develop' into 'main'",
        commit_message:
          "This pull request merges the 'develop' branch into the 'main' branch.",
      });

      console.log(
        `Opened new pull request #${newPr.data.number} in ${repository.full_name}`
      );
    } catch (error) {
      console.error("Error occurred while creating pull request:", error);
    }
  }

  async function waitForCIChecks(context, repository, pullNumber) {
    console.log("Waiting for CI checks to complete...");

    // Get the list of check runs for the pull request
    const checkRuns = await context.octokit.checks.listForRef({
      owner: repository.owner.login,
      repo: repository.name,
      ref: `pull/${pullNumber}/head`,
    });

    // Check if all CI checks have passed
    const allChecksPassed = checkRuns.data.check_runs.every(
      (check) => check.conclusion === "success"
    );

    if (allChecksPassed) {
      console.log("All CI checks have passed.");
    } else {
      console.log("CI checks are still running or have failed.");
      // Wait for a certain amount of time before checking again
      await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait for 1 minute
      await waitForCIChecks(context, repository, pullNumber);
    }
  }

  async function createBranchInForkedRepo(context, repository, sourcePr) {
    try {
      console.log("Fetching the latest commit on the 'dev' branch...");

      // Get the latest commit on the 'dev' branch
      const devBranch = await context.octokit.git.getRef({
        owner: repository.owner.login,
        repo: repository.name,
        ref: "heads/dev",
      });
      const devCommitSha = devBranch.data.object.sha;
      console.log(`Latest commit on 'dev' branch: ${devCommitSha}`);

      console.log("Creating a new branch based on the 'dev' branch...");

      // Create a new branch based on the 'dev' branch
      const branchName = `dev-to-main-${Date.now()}`; // Add a timestamp to ensure unique branch names
      const newRef = await context.octokit.git.createRef({
        owner: repository.owner.login,
        repo: repository.name,
        ref: `refs/heads/${branchName}`,
        sha: devCommitSha,
      });
      console.log(
        `New branch created in forked repository: ${newRef.data.ref}`
      );

      console.log("Opening a new pull request in the main repository...");

      // Open a new pull request in the main repository
      await createPullRequestInMainRepo(context, repository, branchName);
    } catch (error) {
      console.error(
        "Error occurred while creating branch in forked repo:",
        error
      );
    }
  }
  async function createPullRequestInMainRepo(context, sourceRepo, branchName) {
    try {
      console.log("Fetching main repository details...");

      // Get the main repository details
      const mainRepoDetails = await context.octokit.repos.get({
        owner: "reyesprince",
        repo: "my_first_repo",
      });

      console.log(
        "Main repository details fetched:",
        mainRepoDetails.data.full_name
      );

      console.log("Opening a new pull request in the main repository...");

      // Open a new pull request in the main repository
      const newPr = await context.octokit.pulls.create({
        owner: mainRepoDetails.data.owner.login,
        repo: mainRepoDetails.data.name,
        head: `${sourceRepo.owner.login}:${branchName}`,
        base: "main",
        title: `Merge changes from ${sourceRepo.full_name}:${branchName}`,
        body: `This pull request includes the changes merged into the '${branchName}' branch of the forked repository ${sourceRepo.full_name}.`,
      });

      console.log(
        `Opened new pull request #${newPr.data.number} in ${mainRepoDetails.data.full_name}`
      );
    } catch (error) {
      console.error(
        "Error occurred while creating pull request in main repo:",
        error
      );
    }
  }

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
